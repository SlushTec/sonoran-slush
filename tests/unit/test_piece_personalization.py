import json
import os
import subprocess
import sys
from uuid import uuid4
import pytest

from test_commerce_workflows import connected, staff, auth
from test_retail_durability import setup, purchase, cart, SLUG
from services.commerce.app.workflows import database, load, save
from services.commerce.app.retail import fingerprint


def offer(c, count=2, units=1, version=1, **extra):
    return c.post('/v1/admin/retail-test/offers/'+SLUG,headers=staff(),json={
        'expected_version':version,'unit_price_minor':1234,'stock_id':'shared',
        'units_per_item':units,'pieces_per_item':count,**extra})


def item(qty=1, **extra):
    return {'product_slug':SLUG,'quantity':qty,
            'personalization':{'mode':'identical','text':' Test é 🌼 '},**extra}


def create(c,items=None,key=None):
    return c.post('/v1/cart',json={'request_id':key or str(uuid4()),'items':items or [item()]})


def read(c,r):
    return c.get('/v1/cart/'+r['id'],headers=auth(r)).json()


def configured(c,m,count=2,units=1):
    setup(c,m,count=10000)
    assert offer(c,count,units).status_code==200


def test_independent_count_and_exact_copy_to_order(connected,monkeypatch):
    configured(connected,monkeypatch,3,2)
    r=create(connected,[item(2)]);assert r.status_code==200,r.text
    doc=read(connected,r.json())
    line=doc['lines'][0]
    assert line['stock_units']==4
    mapping=line['personalization_snapshot']
    assert mapping['pieces_per_item']==3 and mapping['quantity']==2
    assert len(mapping['pieces'])==6 and mapping['line_index']==0
    assert all(p['text']==' Test é 🌼 ' for p in mapping['pieces'])
    o=purchase(connected,r.json());assert o.status_code==200,o.text
    with database() as db:
        order=load(db,o.json()['id'])
    assert order['lines']==doc['lines']
    assert purchase(connected,r.json()).json()==o.json()


def test_per_piece_ordering_and_duplicate_text_valid(connected,monkeypatch):
    configured(connected,monkeypatch)
    pieces=[{'set_index':0,'piece_index':1,'text':'Same'},{'set_index':0,'piece_index':0,'text':'Same'}]
    r=create(connected,[item(personalization={'mode':'per_piece','pieces':pieces})])
    assert r.status_code==200,r.text
    doc=read(connected,r.json())
    assert doc['items'][0]['personalization']['pieces']==pieces
    assert [x['piece_index'] for x in doc['lines'][0]['personalization_snapshot']['pieces']]==[0,1]


@pytest.mark.parametrize('pieces',[
    [{'set_index':0,'piece_index':0,'text':'A'}],
    [{'set_index':0,'piece_index':0,'text':'A'},{'set_index':0,'piece_index':0,'text':'B'}],
    [{'set_index':0,'piece_index':0,'text':'A'},{'set_index':1,'piece_index':0,'text':'B'}],
    [{'set_index':0,'piece_index':0,'text':'A'},{'set_index':0,'piece_index':2,'text':'B'}],
])
def test_mapping_cardinality_failure_is_atomic(connected,monkeypatch,pieces):
    configured(connected,monkeypatch)
    assert create(connected,[item(personalization={'mode':'per_piece','pieces':pieces})]).status_code==422
    with database() as db:
        assert db.execute("SELECT count(*) FROM records").fetchone()[0]==0


@pytest.mark.parametrize('index',[True,'0',-1,1.2,None])
def test_strict_indices(connected,monkeypatch,index):
    configured(connected,monkeypatch,1)
    assert create(connected,[item(personalization={'mode':'per_piece','pieces':[
        {'set_index':index,'piece_index':0,'text':'A'}]})]).status_code==422


@pytest.mark.parametrize('text',['','   ','bad\ntext','bad\x00text','bad\x85text','\ud800','a'*121])
def test_text_rejects_control_surrogate_and_blank(connected,monkeypatch,text):
    configured(connected,monkeypatch)
    # ensure_ascii avoids the HTTP client encoding an unpaired surrogate before the server sees it.
    payload={'request_id':str(uuid4()),'items':[item(personalization={'mode':'identical','text':text})]}
    r=connected.post('/v1/cart',content=json.dumps(payload),headers={'Content-Type':'application/json'})
    assert r.status_code==422


@pytest.mark.parametrize('extra',[{'text':'A'},{'secondary':'A'},{'options':{'Names':'A,B'}},
                                  {'options':{'set_size':'2'}},{'personalization':None}])
def test_ambiguous_legacy_fields_rejected(connected,monkeypatch,extra):
    configured(connected,monkeypatch)
    assert create(connected,[item(**extra)]).status_code==422


@pytest.mark.parametrize('count',[True,'2',0,101,1.2,None])
def test_staff_piece_count_strict(connected,monkeypatch,count):
    setup(connected,monkeypatch)
    assert offer(connected,count).status_code==422


def test_no_count_not_inferred_from_stock_and_legacy_retained(connected,monkeypatch):
    setup(connected,monkeypatch)
    assert create(connected).status_code==409
    assert cart(connected)
    with database() as db:
        stored=json.loads(db.execute('SELECT document FROM retail_offers WHERE slug=?',(SLUG,)).fetchone()[0])
    assert 'pieces_per_item' not in stored


def test_omitted_update_retains_explicit_count(connected,monkeypatch):
    configured(connected,monkeypatch,3)
    r=connected.post('/v1/admin/retail-test/offers/'+SLUG,headers=staff(),json={
        'expected_version':2,'unit_price_minor':2000,'stock_id':'shared','units_per_item':1})
    assert r.status_code==200 and r.json()['pieces_per_item']==3


def test_count_change_invalidates_cart_without_reservation(connected,monkeypatch):
    configured(connected,monkeypatch)
    c=create(connected).json()
    assert offer(connected,3,version=2).status_code==200
    assert purchase(connected,c).status_code==409
    with database() as db:
        assert db.execute('SELECT count(*) FROM retail_reservations').fetchone()[0]==0


def test_piece_bounds_and_multiline_indices(connected,monkeypatch):
    configured(connected,monkeypatch,100)
    assert create(connected,[item(6)]).status_code==422
    assert create(connected,[item(5)]*5).status_code==422
    r=create(connected,[item(5)]*4);assert r.status_code==200,r.text
    lines=read(connected,r.json())['lines']
    assert [x['personalization_snapshot']['line_index'] for x in lines]==[0,1,2,3]


def test_exact_replay_and_reordered_input_conflicts(connected,monkeypatch):
    configured(connected,monkeypatch)
    pieces=[{'set_index':0,'piece_index':0,'text':'A'},{'set_index':0,'piece_index':1,'text':'B'}]
    entries=[item(personalization={'mode':'per_piece','pieces':pieces})];key=str(uuid4())
    r=create(connected,entries,key);assert r.status_code==200
    assert create(connected,entries,key).json()==r.json()
    entries[0]['personalization']['pieces'].reverse()
    assert create(connected,entries,key).status_code==409


def test_legacy_fingerprint_fixed_prechange_shape(connected,monkeypatch):
    setup(connected,monkeypatch)
    key=str(uuid4());r=cart(connected,request_id=key)
    # Captured shape from pre-change RetailItem, including photo_brief null and all defaults.
    old_item={'product_slug':SLUG,'quantity':1,'text':'','secondary':'','font':'Classic serif',
              'options':{},'notes':'','artwork_name':'','gift':False,'gift_message':'','photo_brief':None}
    expected=fingerprint({'request_id':key,'items':[old_item]})
    with database() as db:
        row=db.execute("SELECT fingerprint FROM requests WHERE id=?",('retail-cart:'+key,)).fetchone()
    assert row[0]==expected
    doc=read(connected,r)
    assert doc['items']==[old_item] and 'personalization_snapshot' not in doc['lines'][0]
    assert cart(connected,request_id=key)==r
    assert purchase(connected,r).status_code==200


@pytest.mark.parametrize('value',[True,'2',0,None])
def test_corrupt_stored_count_bounded(connected,monkeypatch,value):
    configured(connected,monkeypatch)
    with database() as db:
        doc=json.loads(db.execute('SELECT document FROM retail_offers WHERE slug=?',(SLUG,)).fetchone()[0])
        doc['pieces_per_item']=value
        db.execute('UPDATE retail_offers SET document=? WHERE slug=?',(json.dumps(doc),SLUG))
    assert create(connected).status_code==409


@pytest.mark.parametrize('mutation',['null','pieces','index','count','extra'])
def test_corrupt_persisted_mapping_does_not_order(connected,monkeypatch,mutation):
    configured(connected,monkeypatch)
    c=create(connected).json()
    with database() as db:
        doc=load(db,c['id'])
        if mutation=='null': doc['items'][0]['personalization']=None
        elif mutation=='pieces': doc['lines'][0]['personalization_snapshot']['pieces']=None
        elif mutation=='index': doc['lines'][0]['personalization_snapshot']['line_index']=False
        elif mutation=='count': doc['lines'][0]['personalization_snapshot']['pieces_per_item']=True
        else: doc['lines'][0]['personalization_snapshot']['owner_approved']=True
        save(db,doc)
    assert purchase(connected,c).status_code==409
    with database() as db:
        assert db.execute('SELECT count(*) FROM retail_reservations').fetchone()[0]==0


def test_restart_and_proof_revision_do_not_change_mapping(connected,monkeypatch):
    configured(connected,monkeypatch)
    c=create(connected).json();o=purchase(connected,c).json()
    with database() as db: before=load(db,o['id'])['lines']
    code="from services.commerce.app.workflows import database,load; import json,sys\nwith database() as db: print(json.dumps(load(db,sys.argv[1])['lines']))"
    result=subprocess.run([sys.executable,'-c',code,o['id']],env=os.environ.copy(),check=True,capture_output=True,text=True)
    assert json.loads(result.stdout)==before
    for version in (0,1):
        r=connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'proof_text':'Synthetic proof '+str(version),'expected_proof_version':version})
        assert r.status_code==200
    with database() as db: assert load(db,o['id'])['lines']==before

@pytest.mark.parametrize('model,field',[('RetailItem','personalization'),('Offer','pieces_per_item')])
def test_optional_not_nullable_contract_matches_runtime(connected,monkeypatch,model,field):
    from services.commerce.app.main import app
    schemas=app.openapi()['components']['schemas']
    if model == 'Offer':
        ref=app.openapi()['paths']['/v1/admin/retail-test/offers/{slug}']['post']['requestBody']['content']['application/json']['schema']['$ref']
        schema=schemas[ref.rsplit('/',1)[-1]]
    else:
        schema=schemas[model]
    prop=schema['properties'][field]
    assert field not in schema.get('required',[])
    assert 'default' not in prop
    def no_null(node):
        if isinstance(node,dict):
            assert node.get('type')!='null'
            for value in node.values():no_null(value)
        elif isinstance(node,list):
            for value in node:no_null(value)
    no_null(prop)
    setup(connected,monkeypatch)
    response=offer(connected,None) if model=='Offer' else create(connected,[item(personalization=None)])
    assert response.status_code==422
