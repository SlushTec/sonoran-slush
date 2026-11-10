from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
from uuid import uuid4

import pytest
from services.commerce.app.workflows import database, load, save
from test_commerce_workflows import connected, staff, auth, proof, order, session, payment_event, send_event

SLUG = 'makertwist-40oz-tumbler'
OTHER = 'makerflo-40oz-electroplated'


def setup(c, monkeypatch, count=4):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED', 'true')
    assert c.post('/v1/admin/retail-test/stock/shared',json={'expected_version':0,'on_hand':count},headers=staff()).status_code == 200
    for slug in (SLUG, OTHER):
        r=c.post('/v1/admin/retail-test/offers/'+slug,json={'expected_version':0,'unit_price_minor':1234,'stock_id':'shared','units_per_item':1},headers=staff())
        assert r.status_code == 200, r.text


def cart(c, qty=1, slug=SLUG, request_id=None):
    r=c.post('/v1/cart',json={'request_id':request_id or str(uuid4()),'items':[{'product_slug':slug,'quantity':qty}]})
    assert r.status_code == 200, r.text
    return r.json()


def purchase(c, cart):
    return c.post('/v1/cart/'+cart['id']+'/orders',json={'version':1},headers=auth(cart))


def simulate(c, o, **changes):
    body={'event_id':str(uuid4()),'version':1,'amount_minor':1234,'currency':'USD','outcome':'paid',**changes}
    return c.post('/v1/admin/retail-test/orders/'+o['id']+'/payments',json=body,headers=staff())


def release(c,o):
    return c.post('/v1/admin/orders/'+o['id']+'/release',json={'version':1,'inventory_reserved':True,'capacity_confirmed':True},headers=staff())


def test_cart_integer_money_authority_and_restart(connected,monkeypatch):
    setup(connected,monkeypatch)
    c=cart(connected,3)
    doc=connected.get('/v1/cart/'+c['id'],headers=auth(c)).json()
    assert doc['total_minor']==3702 and doc['lines'][0]['unit_price_minor']==1234
    # A fresh interpreter imports the app and opens the same database: no in-memory authority.
    code="from services.commerce.app.workflows import database,load; import json,sys\nwith database() as db: print(json.dumps(load(db,sys.argv[1])))"
    result=subprocess.run([sys.executable,'-c',code,c['id']],check=True,capture_output=True,text=True,env=os.environ.copy())
    assert json.loads(result.stdout)['lines']==doc['lines']
    assert connected.get('/v1/cart/'+c['id'],headers={'Authorization':'Bearer wrong'}).status_code==404
    for quantity in [True,1.5,'2',0,501]:
        assert connected.post('/v1/cart',json={'request_id':str(uuid4()),'items':[{'product_slug':SLUG,'quantity':quantity}]}).status_code==422
    assert connected.post('/v1/cart',json={'request_id':str(uuid4()),'items':[{'product_slug':SLUG,'quantity':1}],'total_minor':1}).status_code==422


def test_retry_and_concurrent_checkout_reserve_once(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    key=str(uuid4()); c=cart(connected,request_id=key)
    assert cart(connected,request_id=key)==c
    assert connected.post('/v1/cart',json={'request_id':key,'items':[{'product_slug':SLUG,'quantity':2}]}).status_code==409
    with ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(lambda _:purchase(connected,c),range(6)))
    assert all(x.status_code==200 for x in results)
    assert len({x.json()['id'] for x in results})==1
    assert purchase(connected,cart(connected,slug=OTHER)).status_code==409
    with database() as db:
        assert db.execute("SELECT SUM(units) FROM retail_reservations WHERE state='active'").fetchone()[0]==1


def test_distinct_concurrent_buyers_cannot_oversell_shared_blanks(connected,monkeypatch):
    setup(connected,monkeypatch,count=2)
    carts=[cart(connected,slug=SLUG if i%2 else OTHER) for i in range(8)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses=list(pool.map(lambda c:purchase(connected,c),carts))
    assert sorted(r.status_code for r in responses)==[200,200]+[409]*6


def test_all_or_nothing_reservation_and_stale_offer(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    body={'request_id':str(uuid4()),'items':[{'product_slug':SLUG,'quantity':1},{'product_slug':OTHER,'quantity':1}]}
    c=connected.post('/v1/cart',json=body).json()
    assert purchase(connected,c).status_code==409
    with database() as db: assert db.execute('SELECT COUNT(*) FROM retail_reservations').fetchone()[0]==0
    c=cart(connected)
    assert connected.post('/v1/admin/retail-test/offers/'+SLUG,json={'expected_version':1,'unit_price_minor':1500,'stock_id':'shared','units_per_item':1},headers=staff()).status_code==200
    assert purchase(connected,c).status_code==409


def test_stock_cas_and_reserved_floor(connected,monkeypatch):
    setup(connected,monkeypatch,count=2)
    purchase(connected,cart(connected))
    for payload in [{'expected_version':0,'on_hand':2},{'expected_version':1,'on_hand':0}]:
        assert connected.post('/v1/admin/retail-test/stock/shared',json=payload,headers=staff()).status_code==409
    assert connected.post('/v1/admin/retail-test/stock/shared',json={'expected_version':1,'on_hand':1},headers=staff()).status_code==200


def test_cancel_releases_exactly_once_and_cannot_be_paid_or_approved(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    o=purchase(connected,cart(connected)).json(); p=proof(connected,o)
    url='/v1/orders/'+o['id']+'/cancel-test'
    first=connected.post(url,json={'version':1},headers=auth(o))
    assert first.status_code==200
    assert first.json()==connected.post(url,json={'version':1},headers=auth(o)).json()
    assert simulate(connected,o).status_code==409
    assert connected.post('/v1/proofs/'+p['id']+'/approve',json={'version':1,'decision':'approve'},headers=auth(p)).status_code==409
    assert release(connected,o).status_code==409
    assert purchase(connected,cart(connected)).status_code==200


def test_complete_local_slice_and_invalid_transitions(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    o=purchase(connected,cart(connected)).json()
    assert connected.post('/v1/checkout/sessions',json={'order_id':o['id'],'version':1},headers=auth(o)).status_code==409
    assert release(connected,o).status_code==409
    assert simulate(connected,o,amount_minor=1).status_code==409
    event_id=str(uuid4())
    assert simulate(connected,o,event_id=event_id,outcome='failed').status_code==200
    assert simulate(connected,o,event_id=event_id).status_code==409
    event_id=str(uuid4())
    assert simulate(connected,o,event_id=event_id).json()['applied'] is True
    assert simulate(connected,o,event_id=event_id).json()['applied'] is False
    assert connected.post('/v1/orders/'+o['id']+'/cancel-test',json={'version':1},headers=auth(o)).status_code==409
    p=proof(connected,o)
    connected.post('/v1/proofs/'+p['id']+'/approve',json={'version':1,'decision':'approve'},headers=auth(p))
    assert release(connected,o).status_code==409  # body booleans cannot invent capacity
    assert connected.post('/v1/admin/retail-test/orders/'+o['id']+'/capacity',json={'version':1,'confirmed':True},headers=staff()).status_code==200
    proof(connected,o,1)
    assert release(connected,o).status_code==409  # revision invalidates approval
    connected.post('/v1/proofs/'+p['id']+'/approve',json={'version':2,'decision':'approve'},headers=auth(p))
    assert release(connected,o).json()['reservation_status']=='consumed'
    assert release(connected,o).status_code==200
    with database() as db:
        assert db.execute("SELECT on_hand FROM retail_stock WHERE id='shared'").fetchone()[0]==0
        assert load(db,o['id'])['payment_status']=='paid'
    ship={'version':1,'carrier':'TEST ONLY','tracking':'NO-REAL-SHIPMENT'}
    url='/v1/admin/orders/'+o['id']+'/ship'
    first=connected.post(url,json=ship,headers=staff())
    assert first.json()==connected.post(url,json=ship,headers=staff()).json()
    assert first.json()['status']=='shipped'
    assert release(connected,o).status_code==409


def test_missing_reservation_cannot_be_asserted_by_staff(connected,monkeypatch):
    setup(connected,monkeypatch)
    o=purchase(connected,cart(connected)).json()
    with database() as db:
        db.execute("UPDATE retail_reservations SET state='released' WHERE order_id=?",(o['id'],))
    assert simulate(connected,o).status_code==409
    assert release(connected,o).status_code==409


def test_flags_staff_gates_crystal_validation_and_truthful_capabilities(connected,monkeypatch):
    assert connected.post('/v1/cart',json={}).status_code==503
    setup(connected,monkeypatch)
    assert connected.post('/v1/admin/retail-test/stock/shared',json={'expected_version':1,'on_hand':8}).status_code==401
    assert connected.post('/v1/cart',json={'request_id':str(uuid4()),'items':[{'product_slug':'photo-crystal-heart','quantity':1}]}).status_code==422
    monkeypatch.setenv('SONORAN_STAGE','production')
    assert connected.get('/v1/capabilities').json()['local_request_workflow'] is False
    assert connected.get('/v1/capabilities').json()['local_retail_test'] is False
    assert connected.get('/v1/retail-test/catalog').status_code==503
    assert connected.get('/ready').status_code==503


def test_square_identity_amount_currency_and_version_reconciliation(connected,monkeypatch):
    o=order(connected); session(connected,o,monkeypatch)
    base=payment_event(o['id'])
    for field,value in [('order_id','wrong'),('location_id','wrong'),('id','wrong')]:
        event=json.loads(json.dumps(base));event['data']['object']['payment'][field]=value
        assert send_event(connected,event).status_code in (400,409)
    event=json.loads(json.dumps(base));event['data']['object']['payment']['amount_money']['currency']='EUR'
    assert send_event(connected,event).status_code==409
    with database() as db:
        doc=load(db,o['id']);doc['version']=2;save(db,doc)
    assert send_event(connected,base).status_code==409


def test_square_duplicate_identity_and_session_retry(connected,monkeypatch):
    o=order(connected);session(connected,o,monkeypatch)
    monkeypatch.setattr('services.commerce.app.payments.square_checkout',lambda _:pytest.fail('must reuse persisted link'))
    assert connected.post('/v1/checkout/sessions',json={'order_id':o['id'],'version':1},headers=auth(o)).status_code==200
    event=payment_event(o['id'])
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses=list(pool.map(lambda _:send_event(connected,event),range(4)))
    assert sum(r.json()['applied'] for r in responses)==1
    event['extra']='changed contents'
    assert send_event(connected,event).status_code==409
    event=payment_event(o['id'],event_id='new-event');event['data']['id']='different-payment';event['data']['object']['payment']['id']='different-payment'
    assert send_event(connected,event).status_code==409
    monkeypatch.setenv('SQUARE_ENVIRONMENT','production')
    assert send_event(connected,event).status_code==503


def test_photo_brief_is_durable_metadata_only_and_old_requests_keep_fingerprint(connected):
    from test_commerce_workflows import inquiry
    from hashlib import sha256
    body=inquiry()
    response=connected.post('/v1/quotes',json=body);q=response.json()
    with database() as db:
        doc=load(db,q['id'])
        assert 'photo_brief' not in doc['items'][0]
    body['items'][0]['photo_brief']=None
    assert connected.post('/v1/quotes',json=body).json()==q
    brief={'instructions':'Place both subjects together; review composition.', 'photos':[{'local_file_id':str(uuid4()),'filename':'first.jpg','note':'Primary subject'},{'local_file_id':str(uuid4()),'filename':'second.png'}]}
    body=inquiry();body['items'][0]['photo_brief']=brief
    r=connected.post('/v1/quotes',json=body);assert r.status_code==200,r.text
    doc=connected.get('/v1/quotes/'+r.json()['id'],headers=auth(r.json())).json()
    saved=doc['items'][0]['photo_brief'];assert saved['media_uploaded'] is False and len(saved['photos'])==2
    assert connected.post('/v1/quotes',json=body).json()==r.json()
    body['request_id']=str(uuid4());body['items'][0]['photo_brief']['media_uploaded']=True
    assert connected.post('/v1/quotes',json=body).status_code==422
    body['items'][0]['photo_brief']['media_uploaded']=False
    body['items'][0]['photo_brief']['photos'][1]['local_file_id']=brief['photos'][0]['local_file_id']
    assert connected.post('/v1/quotes',json=body).status_code==422


def test_order_reservation_and_payment_survive_separate_process(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    o=purchase(connected,cart(connected)).json();assert simulate(connected,o).status_code==200
    code="from services.commerce.app.workflows import database,load; import json,sys\nwith database() as db:\n d=load(db,sys.argv[1]); print(json.dumps([d['payment_status'],db.execute('SELECT state FROM retail_reservations WHERE order_id=?',(sys.argv[1],)).fetchone()[0]]))"
    result=subprocess.run([sys.executable,'-c',code,o['id']],check=True,capture_output=True,text=True,env=os.environ.copy())
    assert json.loads(result.stdout)==['paid','active']
    assert purchase(connected,cart(connected)).status_code==409


def test_square_network_retry_keeps_idempotency_and_failed_attempt_uncommitted(connected,monkeypatch):
    from fastapi import HTTPException
    from services.commerce.app import payments
    o=order(connected); keys=[]
    def interrupted(fields):
        keys.append(fields['idempotency_key'])
        raise HTTPException(502,'Simulated provider response lost')
    monkeypatch.setattr(payments,'square_checkout',interrupted)
    assert connected.post('/v1/checkout/sessions',json={'order_id':o['id'],'version':1},headers=auth(o)).status_code==502
    with database() as db: assert not load(db,o['id']).get('checkout_session_id')
    session(connected,o,monkeypatch)
    assert keys==['sonoran:'+o['id']+':1']


@pytest.mark.parametrize('value',[True,1.2,'1234',0,-1,100000000])
def test_offer_money_is_strict_and_bounded(connected,monkeypatch,value):
    setup(connected,monkeypatch)
    r=connected.post('/v1/admin/retail-test/offers/'+SLUG,json={'expected_version':1,'unit_price_minor':value,'stock_id':'shared','units_per_item':1},headers=staff())
    assert r.status_code==422


def test_cancel_payment_race_has_one_winner_and_no_stock_loss(connected,monkeypatch):
    setup(connected,monkeypatch,count=1)
    o=purchase(connected,cart(connected)).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        cancel=pool.submit(connected.post,'/v1/orders/'+o['id']+'/cancel-test',json={'version':1},headers=auth(o))
        payment=pool.submit(simulate,connected,o)
        results=[cancel.result(),payment.result()]
    assert sorted(r.status_code for r in results)==[200,409]
    with database() as db:
        doc=load(db,o['id']); state=db.execute('SELECT state FROM retail_reservations WHERE order_id=?',(o['id'],)).fetchone()[0]
        assert (doc['payment_status'],doc['status'],state) in [('unpaid','cancelled','released'),('paid','awaiting_approval','active')]


def test_duplicate_lines_and_set_units_share_the_same_stock_budget(connected,monkeypatch):
    setup(connected,monkeypatch,count=3)
    connected.post('/v1/admin/retail-test/offers/'+SLUG,json={'expected_version':1,'unit_price_minor':1234,'stock_id':'shared','units_per_item':2},headers=staff())
    body={'request_id':str(uuid4()),'items':[{'product_slug':SLUG,'quantity':1},{'product_slug':OTHER,'quantity':1}]}
    c=connected.post('/v1/cart',json=body).json();o=purchase(connected,c)
    assert o.status_code==200
    with database() as db:
        assert db.execute('SELECT units FROM retail_reservations WHERE order_id=?',(o.json()['id'],)).fetchone()[0]==3
    assert purchase(connected,cart(connected,slug=OTHER)).status_code==409


def test_square_transport_is_sandbox_only_and_rejects_unsafe_link(connected,monkeypatch):
    from services.commerce.app import payments
    from fastapi import HTTPException
    captured=[]
    class Response:
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def read(self,limit): return json.dumps({'payment_link':{'id':'link','order_id':'provider-order','url':'https://evil.example/checkout'}}).encode()
    def fake(request,timeout):
        captured.append(request.full_url)
        assert request.get_header('Square-version')=='2026-09-16'
        return Response()
    monkeypatch.setattr(payments.urllib.request,'build_opener',lambda *handlers: type('MockOpener',(),{'open':staticmethod(fake)})())
    with pytest.raises(HTTPException) as error: payments.square_checkout({'idempotency_key':'fixture'})
    assert error.value.status_code==502
    assert captured==['https://connect.squareupsandbox.com/v2/online-checkout/payment-links']


@pytest.mark.parametrize('stage', ['local', 'production'])
def test_non_scaffold_stages_reject_workflows_and_app_creation(connected, monkeypatch, stage):
    from fastapi import HTTPException
    from services.commerce.app.workflows import enabled
    from services.common.runtime import create_app

    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED', 'true')
    monkeypatch.setenv('SONORAN_STAGE', stage)
    with pytest.raises(HTTPException) as error:
        enabled()
    assert error.value.status_code == 503
    flags = connected.get('/v1/capabilities').json()
    for flag in ('local_request_workflow', 'local_retail_test', 'production_ready',
                 'live_payments', 'private_uploads', 'live_email'):
        assert flags[flag] is False
    assert connected.get('/v1/retail-test/catalog').status_code == 503
    assert connected.post('/v1/cart', json={}).status_code == 503
    with pytest.raises(RuntimeError, match='must not run'):
        create_app('commerce')
