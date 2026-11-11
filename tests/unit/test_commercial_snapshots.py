from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
from uuid import uuid4

import pytest
from test_commerce_workflows import connected, staff
from services.commerce.app.workflows import database

BASE='/v1/admin/retail-test/commercial'
SLUG='makertwist-40oz-tumbler'
OTHER='makerflo-40oz-electroplated'


def draft(kind='catalog', **change):
    rows={'catalog':[{'product_slug':SLUG,'fixture_eligible':True}],
          'prices':[{'product_slug':SLUG,'variant_key':'fixture-standard','unit_price_minor':1234,'currency':'USD'}],
          'policies':[{'policy_key':'fixture-policy','fixture_text':'Synthetic text, not a customer promise.'}]}[kind]
    return {'request_id':str(uuid4()),'previous_revision':0,'source_reference':'fixture-source','kind':kind,'rows':rows,**change}


def create(c,name,kind='catalog',revision=1,**change):
    return c.post(BASE+'/snapshots/'+name+'/versions/'+str(revision),json=draft(kind,**change),headers=staff())


def review(c,name,revision=1,**change):
    body={'request_id':str(uuid4()),'expected_lifecycle_version':1,'decision':'approve_test','reason':'Synthetic test review',**change}
    return c.post(BASE+'/snapshots/'+name+'/versions/'+str(revision)+'/review-test',json=body,headers=staff())


def snap(c,name,revision=1):
    return c.get(BASE+'/snapshots/'+name+'/versions/'+str(revision),headers=staff())


def references(prefix='one'):
    return {kind:{'snapshot_id':prefix+'-'+kind,'revision':1} for kind in ('catalog','prices','policies')}


def fixture(c,monkeypatch,prefix='one',amount=1234):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    for kind in ('catalog','prices','policies'):
        changes={'rows':[{'product_slug':SLUG,'variant_key':'fixture-standard','unit_price_minor':amount}]} if kind=='prices' else {}
        r=create(c,prefix+'-'+kind,kind,**changes); assert r.status_code==200,r.text
        assert review(c,prefix+'-'+kind).status_code==200
    r=c.post(BASE+'/sets/'+prefix,json={'request_id':str(uuid4()),**references(prefix)},headers=staff())
    assert r.status_code==200,r.text
    return r.json()


def select(c,set_id='one',**change):
    return c.post(BASE+'/current-test',json={'request_id':str(uuid4()),'expected_pointer_version':0,'set_id':set_id,'action':'publish_test','reason':'Synthetic test selection',**change},headers=staff())


def assert_scope(data):
    assert data['test_mode'] is True
    assert data['owner_approved'] is False and data['production_approved'] is False


def test_snapshot_lifecycle_never_claims_owner_approval(connected,monkeypatch):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    request=draft()
    url=BASE+'/snapshots/catalog/versions/1'
    first=connected.post(url,json=request,headers=staff()); assert first.status_code==200
    assert_scope(first.json()); assert first.json()['status']=='draft'
    approved=review(connected,'catalog');assert approved.status_code==200
    assert approved.json()['status']=='approved_test';assert_scope(approved.json())
    assert approved.json()['audit'][-1]['actor']=='synthetic_staff'
    assert connected.post(url,json=request,headers=staff()).json()==first.json()
    retired=review(connected,'catalog',expected_lifecycle_version=2,decision='retire_test')
    assert retired.status_code==200 and retired.json()['status']=='retired_test'
    assert_scope(retired.json())
    assert review(connected,'catalog',expected_lifecycle_version=3).status_code==409
    assert first.json()['rows']==retired.json()['rows']


@pytest.mark.parametrize('change',[
    {'owner_approved':True},{'production_approved':True},{'status':'approved'},{'actor':'owner'},
    {'previous_revision':True},{'previous_revision':'0'},{'source_reference':'invalid reference'},
    {'rows':[]},{'kind':'tax'},
    {'rows':[{'product_slug':SLUG,'fixture_eligible':'true'}]},
    {'rows':[{'product_slug':SLUG,'fixture_eligible':True}]*2},
])
def test_draft_rejects_fake_authority_and_invalid_shape(connected,monkeypatch,change):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    assert connected.post(BASE+'/snapshots/bad/versions/1',json={**draft(),**change},headers=staff()).status_code==422
    assert snap(connected,'bad').status_code==404


@pytest.mark.parametrize('amount',[True,False,0,-1,1.5,'1234',100000000])
def test_price_money_is_strict_integer_usd(connected,monkeypatch,amount):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    r=create(connected,'price','prices',rows=[{'product_slug':SLUG,'variant_key':'fixture','unit_price_minor':amount}])
    assert r.status_code==422


@pytest.mark.parametrize('rows',[
    [{'product_slug':SLUG,'variant_key':'fixture','unit_price_minor':1234,'currency':'EUR'}],
    [{'product_slug':SLUG,'variant_key':'fixture','unit_price_minor':1234}]*2,
])
def test_price_currency_and_duplicate_variants(connected,monkeypatch,rows):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    assert create(connected,'price','prices',rows=rows).status_code==422


@pytest.mark.parametrize('text',['','   ','a\x00b','x'*4001])
def test_policy_text_is_bounded_fixture_data(connected,monkeypatch,text):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    assert create(connected,'policies','policies',rows=[{'policy_key':'fixture','fixture_text':text}]).status_code==422


def test_append_only_revision_kind_and_stale_commands(connected,monkeypatch):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    assert create(connected,'cat').status_code==200
    assert create(connected,'cat').status_code==409
    assert create(connected,'cat',revision=3,previous_revision=1).status_code==409
    assert create(connected,'cat','prices',revision=2,previous_revision=1).status_code==409
    assert create(connected,'cat',revision=2,previous_revision=1).status_code==200
    assert snap(connected,'cat',1).json()['status']=='draft'
    assert snap(connected,'cat',2).json()['revision']==2
    assert create(connected,'unknown',rows=[{'product_slug':'unknown','fixture_eligible':True}]).status_code==422


def test_new_publication_changes_future_test_resolution_not_history(connected,monkeypatch):
    first=fixture(connected,monkeypatch,'one',1234)
    a=select(connected);assert a.status_code==200
    fixture(connected,monkeypatch,'two',5678)
    b=select(connected,'two',expected_pointer_version=1);assert b.status_code==200
    current=connected.get(BASE+'/current-test',headers=staff()).json()
    assert current['snapshots']['prices']['rows'][0]['unit_price_minor']==5678
    assert_scope(current)
    history=connected.get(BASE+'/sets/one',headers=staff()).json()
    assert history['historical_manifest_only'] is True and history['content_hashes']==first['content_hashes']
    assert snap(connected,'one-prices').json()['rows'][0]['unit_price_minor']==1234
    assert select(connected,'one',expected_pointer_version=2,action='rollback_test').status_code==200
    assert connected.get(BASE+'/current-test',headers=staff()).json()['snapshots']['prices']['rows'][0]['unit_price_minor']==1234
    assert connected.get('/v1/retail-test/catalog').json()['offers']==[]
    assert connected.get('/v1/catalog').json()['production_approved'] is False
    assert connected.get('/ready').status_code==503


def test_rollback_only_previously_published_still_valid_sets(connected,monkeypatch):
    fixture(connected,monkeypatch,'one');fixture(connected,monkeypatch,'two')
    assert select(connected,'one',action='rollback_test').status_code==409
    assert select(connected,'one').status_code==200
    assert select(connected,'two',expected_pointer_version=1,action='rollback_test').status_code==409
    assert select(connected,'two',expected_pointer_version=1).status_code==200
    assert review(connected,'one-prices',expected_lifecycle_version=2,decision='retire_test').status_code==200
    assert select(connected,'one',expected_pointer_version=2,action='rollback_test').status_code==409
    assert connected.get(BASE+'/current-test',headers=staff()).json()['set_id']=='two'


def test_retirement_fails_current_resolution_closed_without_fallback(connected,monkeypatch):
    fixture(connected,monkeypatch);assert select(connected).status_code==200
    assert review(connected,'one-prices',expected_lifecycle_version=2,decision='retire_test').status_code==200
    assert connected.get(BASE+'/current-test',headers=staff()).status_code==409
    assert connected.get(BASE+'/sets/one',headers=staff()).json()['historical_manifest_only'] is True


def test_set_rejects_kind_state_and_product_mismatch(connected,monkeypatch):
    fixture(connected,monkeypatch)
    for bad in [
        {**references(),'prices':references()['catalog']},
        {**references(),'prices':{'snapshot_id':'missing','revision':1}},
    ]:
        assert connected.post(BASE+'/sets/bad',json={'request_id':str(uuid4()),**bad},headers=staff()).status_code in (404,409)
    assert create(connected,'draft-prices','prices').status_code==200
    refs={**references(),'prices':{'snapshot_id':'draft-prices','revision':1}}
    assert connected.post(BASE+'/sets/draft-set',json={'request_id':str(uuid4()),**refs},headers=staff()).status_code==409
    assert create(connected,'wrong-prices','prices',rows=[{'product_slug':OTHER,'variant_key':'fixture','unit_price_minor':1234}]).status_code==200
    assert review(connected,'wrong-prices').status_code==200
    refs={**references(),'prices':{'snapshot_id':'wrong-prices','revision':1}}
    assert connected.post(BASE+'/sets/wrong-set',json={'request_id':str(uuid4()),**refs},headers=staff()).status_code==409


def test_exact_replay_and_cross_operation_identity(connected,monkeypatch):
    fixture(connected,monkeypatch)
    request={'request_id':str(uuid4()),'expected_pointer_version':0,'set_id':'one','action':'publish_test','reason':'Synthetic selection'}
    first=connected.post(BASE+'/current-test',json=request,headers=staff())
    assert first.status_code==200
    assert connected.post(BASE+'/current-test',json=request,headers=staff()).json()==first.json()
    assert connected.post(BASE+'/current-test',json={**request,'reason':'changed'},headers=staff()).status_code==409
    assert create(connected,'another',request_id=request['request_id']).status_code==409
    assert select(connected,expected_pointer_version=0).status_code==409


def test_concurrent_pointer_and_snapshot_creation_have_one_winner(connected,monkeypatch):
    fixture(connected,monkeypatch)
    with ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(lambda _:select(connected),range(5)))
    assert sorted(r.status_code for r in results)==[200]+[409]*4
    with ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(lambda _:create(connected,'concurrent'),range(5)))
    assert sorted(r.status_code for r in results)==[200]+[409]*4


def test_command_failure_rolls_back_draft_review_pointer_and_audit(connected,monkeypatch):
    fixture(connected,monkeypatch)
    assert create(connected,'review-target').status_code==200
    with database() as db:
        db.execute("CREATE TRIGGER fail_commercial_command BEFORE INSERT ON fixture_commercial_commands BEGIN SELECT RAISE(ABORT,'injected'); END")
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):create(connected,'will-rollback')
    assert snap(connected,'will-rollback').status_code==404
    with pytest.raises(sqlite3.IntegrityError):review(connected,'review-target')
    assert snap(connected,'review-target').json()['status']=='draft'
    with pytest.raises(sqlite3.IntegrityError):select(connected)
    assert connected.get(BASE+'/current-test',headers=staff()).status_code==404
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_commercial_publications').fetchone()[0]==0


def test_immutable_hash_and_pointer_identity_corruption_fail_closed(connected,monkeypatch):
    fixture(connected,monkeypatch);assert select(connected).status_code==200
    with database() as db:
        doc=json.loads(db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='one-prices' AND revision=1").fetchone()[0])
        doc['rows'][0]['unit_price_minor']=9999
        db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='one-prices' AND revision=1",(json.dumps(doc),))
    assert connected.get(BASE+'/current-test',headers=staff()).status_code==409


def test_persistence_and_global_gates(connected,monkeypatch):
    fixture(connected,monkeypatch);assert select(connected).status_code==200
    code="from services.commerce.app.workflows import database; import json\nwith database() as d: print(d.execute('SELECT document FROM fixture_commercial_pointer').fetchone()[0])"
    output=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True,check=True,env=os.environ.copy())
    assert json.loads(output.stdout)['set_id']=='one'
    for method,path,data in [('get','/current-test',None),('get','/sets/one',None),('get','/snapshots/one-prices/versions/1',None),('post','/snapshots/x/versions/1',draft()),('post','/snapshots/one-prices/versions/1/review-test',{'request_id':str(uuid4()),'expected_lifecycle_version':2,'decision':'retire_test','reason':'Fixture'}),('post','/sets/x',{'request_id':str(uuid4()),**references()})]:
        r=getattr(connected,method)(BASE+path,**({'json':data} if data is not None else {}))
        assert r.status_code==401
    monkeypatch.setenv('SONORAN_STAGE','production')
    assert connected.get(BASE+'/current-test',headers=staff()).status_code==503
    assert create(connected,'production').status_code==503
    assert connected.get('/ready').status_code==503


def test_pointer_publication_vs_retirement_never_serves_retired_rows(connected,monkeypatch):
    fixture(connected,monkeypatch)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda op:select(connected) if op=='publish' else review(connected,'one-prices',expected_lifecycle_version=2,decision='retire_test'),['publish','retire']))
    assert results[1].status_code==200
    assert results[0].status_code in (200,409)
    assert connected.get(BASE+'/current-test',headers=staff()).status_code in (404,409)


def test_current_pointer_has_supported_counter_limit_and_identity_checks(connected,monkeypatch):
    fixture(connected,monkeypatch);assert select(connected).status_code==200
    with database() as db:
        doc=json.loads(db.execute("SELECT document FROM fixture_commercial_pointer").fetchone()[0])
        doc['pointer_version']=1000000
        db.execute("UPDATE fixture_commercial_pointer SET version=1000000,document=?",(json.dumps(doc),))
    assert select(connected,expected_pointer_version=1000000).status_code==409
    with database() as db:
        db.execute("UPDATE fixture_commercial_pointer SET version=1")
    assert connected.get(BASE+'/current-test',headers=staff()).status_code==409


def test_set_creation_and_snapshot_identity_corruption_fail_closed(connected,monkeypatch):
    fixture(connected,monkeypatch)
    with database() as db:
        doc=json.loads(db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='one-catalog'").fetchone()[0])
        doc['id']='different-id'
        db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='one-catalog'",(json.dumps(doc),))
    assert snap(connected,'one-catalog').status_code==409
    assert select(connected).status_code==409


@pytest.mark.parametrize('table,where,path',[
    ('fixture_commercial_snapshots',"id='one-prices'",'/snapshots/one-prices/versions/1'),
    ('fixture_commercial_sets',"id='one'",'/sets/one'),
    ('fixture_commercial_pointer',"slot='current'",'/current-test'),
])
def test_corrupt_fixture_json_fails_with_controlled_reconciliation(connected,monkeypatch,table,where,path):
    fixture(connected,monkeypatch);assert select(connected).status_code==200
    with database() as db:
        db.execute(f"UPDATE {table} SET document='not-json' WHERE {where}")
    assert connected.get(BASE+path,headers=staff()).status_code==409


def test_replay_never_promotes_stored_scope_metadata(connected,monkeypatch):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    request=draft();url=BASE+'/snapshots/test/versions/1'
    assert connected.post(url,json=request,headers=staff()).status_code==200
    with database() as db:
        doc=json.loads(db.execute('SELECT document FROM fixture_commercial_commands WHERE request_id=?',(request['request_id'],)).fetchone()[0])
        doc.update(owner_approved=True,production_approved=True,test_mode=False)
        db.execute('UPDATE fixture_commercial_commands SET document=? WHERE request_id=?',(json.dumps(doc),request['request_id']))
    assert_scope(connected.post(url,json=request,headers=staff()).json())
