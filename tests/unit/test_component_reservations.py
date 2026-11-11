from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
from uuid import uuid4

import pytest
from test_commerce_workflows import connected, staff
from test_stock_ledger import BASE, bucket
from services.commerce.app.workflows import database

BOM=BASE+'/boms/gift/versions/1'
SLUG='makertwist-40oz-tumbler'


def fixture(c,monkeypatch):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    for component,kind in [('blank','blank'),('base','base')]:
        assert c.put(BASE+'/components/'+component,json={'kind':kind,'unit':'piece'},headers=staff()).status_code==200
    for location in ('shop','market'):
        assert c.put(BASE+'/locations/'+location,json={'kind':'workshop' if location=='shop' else 'market'},headers=staff()).status_code==200
    for lot,component,quantity in [('blank-lot','blank',10),('base-lot','base',20)]:
        assert c.put(BASE+'/lots/'+lot,json={'component_id':component,'supplier_reference':'fixture','lot_reference':lot},headers=staff()).status_code==200
        r=c.post(BASE+'/lots/'+lot+'/movements',json={'request_id':str(uuid4()),'expected_version':0,'quantity':quantity,'purpose':'receipt','destination':bucket(),'reason':'Fixture receipt'},headers=staff())
        assert r.status_code==200,r.text
    assert c.put(BOM,json=bill(),headers=staff()).status_code==200


def bill(**change):
    return {'product_slug':SLUG,'components':[{'component_id':'blank','units_per_item':1},{'component_id':'base','units_per_item':2}],**change}


def plan(**change):
    return {'quantity':2,'allocations':[{'lot_id':'blank-lot','location_id':'shop','units':2},{'lot_id':'base-lot','location_id':'shop','units':4}],**change}


def reserve_body(**change):
    return {**plan(),'request_id':str(uuid4()),'lot_versions':{'blank-lot':1,'base-lot':1},'reason':'Fixture hold',**change}


def reserve(c,**change):
    return c.post(BOM+'/reservations',json=reserve_body(**change),headers=staff())


def transition_body(**change):
    return {'request_id':str(uuid4()),'expected_version':1,'lot_versions':{'blank-lot':2,'base-lot':2},'reason':'Fixture transition',**change}


def transition(c,hold,action='release',**change):
    return c.post(BASE+'/reservations/'+hold['id']+'/'+action,json=transition_body(**change),headers=staff())


def balances(c,lot):
    r=c.get(BASE+'/lots/'+lot,headers=staff()); assert r.status_code==200
    return r.json()


def test_bom_immutable_versions_and_normalized_component_order(connected,monkeypatch):
    fixture(connected,monkeypatch)
    original=connected.get(BOM,headers=staff()).json()
    assert original['checkout_authoritative'] is False
    reverse=bill(components=list(reversed(bill()['components'])))
    assert connected.put(BOM,json=reverse,headers=staff()).json()==original
    assert connected.put(BOM,json=bill(components=[{'component_id':'blank','units_per_item':2}]),headers=staff()).status_code==409
    assert connected.put(BASE+'/boms/gift/versions/2',json=bill(components=[{'component_id':'blank','units_per_item':2}]),headers=staff()).status_code==200
    assert connected.get(BOM,headers=staff()).json()==original
    assert connected.get(BASE+'/boms/gift/versions/99',headers=staff()).status_code==404


@pytest.mark.parametrize('payload',[
    bill(components=[]), bill(components=[{'component_id':'blank','units_per_item':True}]),
    bill(components=[{'component_id':'blank','units_per_item':0}]),
    bill(components=[{'component_id':'blank','units_per_item':'1'}]),
    bill(components=[{'component_id':'blank','units_per_item':1}]*2),
    bill(components=[{'component_id':'blank','units_per_item':1000001}]),
    {**bill(),'price':1},
])
def test_invalid_bom_shape(connected,monkeypatch,payload):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    assert connected.put(BASE+'/boms/bad/versions/1',json=payload,headers=staff()).status_code==422


def test_unknown_component_product_and_unit_authority(connected,monkeypatch):
    fixture(connected,monkeypatch)
    assert connected.put(BASE+'/boms/x/versions/1',json=bill(product_slug='unknown-listing'),headers=staff()).status_code==422
    assert connected.put(BASE+'/boms/x/versions/1',json=bill(components=[{'component_id':'missing','units_per_item':1}]),headers=staff()).status_code==409
    # Component unit is frozen by server definitions, not accepted from callers.
    invalid=bill(components=[{'component_id':'blank','units_per_item':1,'unit':'gram'}])
    assert connected.put(BASE+'/boms/x/versions/1',json=invalid,headers=staff()).status_code==422


@pytest.mark.parametrize('change',[
    {'quantity':True},{'quantity':0},{'quantity':'2'},{'quantity':501},
    {'allocations':[]},
    {'allocations':[{'lot_id':'blank-lot','location_id':'shop','units':True}]},
    {'allocations':[{'lot_id':'blank-lot','location_id':'shop','units':0}]},
    {'allocations':[{'lot_id':'blank-lot','location_id':'shop','units':1}]*2},
    {'allocations':[{'lot_id':'blank-lot','location_id':'shop','units':2,'condition':'damaged'}]},
])
def test_plan_strict_shape(connected,monkeypatch,change):
    fixture(connected,monkeypatch)
    assert connected.post(BOM+'/plan',json=plan(**change),headers=staff()).status_code==422


@pytest.mark.parametrize('allocations',[
    [{'lot_id':'blank-lot','location_id':'shop','units':2}],
    [{'lot_id':'blank-lot','location_id':'shop','units':3},{'lot_id':'base-lot','location_id':'shop','units':4}],
    [{'lot_id':'blank-lot','location_id':'market','units':2},{'lot_id':'base-lot','location_id':'shop','units':4}],
    [{'lot_id':'blank-lot','location_id':'missing','units':2},{'lot_id':'base-lot','location_id':'shop','units':4}],
])
def test_missing_excess_or_unavailable_allocations_have_no_mutation(connected,monkeypatch,allocations):
    fixture(connected,monkeypatch)
    assert connected.post(BOM+'/plan',json=plan(allocations=allocations),headers=staff()).status_code==409
    assert balances(connected,'blank-lot')['version']==1
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_allocations').fetchone()[0]==0


def test_read_only_plan_and_reserve_release_replay(connected,monkeypatch):
    fixture(connected,monkeypatch)
    p=connected.post(BOM+'/plan',json=plan(),headers=staff()).json()
    assert p['lot_versions']=={'base-lot':1,'blank-lot':1}
    assert all(a['reserved_units']==0 for a in p['allocations'])
    assert balances(connected,'blank-lot')['version']==1
    request=reserve_body()
    r=connected.post(BOM+'/reservations',json=request,headers=staff()); assert r.status_code==200,r.text
    hold=r.json()
    assert hold['state']=='active' and hold['bom']['revision']==1
    assert connected.post(BOM+'/reservations',json=request,headers=staff()).json()==hold
    p=connected.post(BOM+'/plan',json=plan(),headers=staff()).json()
    assert [a['free_units'] for a in p['allocations']]==[16,8]
    assert [a['reserved_units'] for a in p['allocations']]==[4,2]
    command=transition_body()
    url=BASE+'/reservations/'+hold['id']+'/release'
    released=connected.post(url,json=command,headers=staff()); assert released.status_code==200,released.text
    assert released.json()['state']=='released'
    assert connected.post(url,json=command,headers=staff()).json()==released.json()
    assert connected.post(BOM+'/reservations',json=request,headers=staff()).json()==hold
    assert transition(connected,hold,'consume',lot_versions={'blank-lot':3,'base-lot':3},expected_version=2).status_code==409
    assert all(a['reserved_units']==0 for a in connected.post(BOM+'/plan',json=plan(),headers=staff()).json()['allocations'])
    assert balances(connected,'blank-lot')['balances']==[{'location_id':'shop','condition':'available','units':10}]


def test_consume_moves_fixture_condition_not_retail_or_real_production(connected,monkeypatch):
    fixture(connected,monkeypatch);hold=reserve(connected).json()
    r=transition(connected,hold,'consume'); assert r.status_code==200,r.text
    assert r.json()['state']=='consumed' and r.json()['checkout_authoritative'] is False
    assert len(r.json()['audit'])==2 and r.json()['audit'][1]['actor']=='synthetic_staff'
    b=balances(connected,'blank-lot')['balances']
    assert b==[{'location_id':'shop','condition':'available','units':8},{'location_id':'shop','condition':'in_production','units':2}]
    assert connected.get('/v1/retail-test/catalog').json()['offers']==[]
    assert connected.get('/ready').status_code==503


def test_every_existing_outflow_protects_reserved_floor(connected,monkeypatch):
    fixture(connected,monkeypatch);hold=reserve(connected).json()
    for purpose,destination in [('transfer',bucket('market')),('count_correction',None)]:
        before=balances(connected,'blank-lot')
        r=connected.post(BASE+'/lots/blank-lot/movements',json={'request_id':str(uuid4()),'expected_version':2,'quantity':9,'purpose':purpose,'source':bucket(),'destination':destination,'reason':'Fixture outflow'},headers=staff())
        assert r.status_code==409,r.text
        assert balances(connected,'blank-lot')==before
    # Exactly the unreserved floor can move; consuming our hold then preserves that other bucket.
    r=connected.post(BASE+'/lots/blank-lot/movements',json={'request_id':str(uuid4()),'expected_version':2,'quantity':8,'purpose':'transfer','source':bucket(),'destination':bucket('market'),'reason':'Fixture transfer'},headers=staff())
    assert r.status_code==200
    assert transition(connected,hold,'consume',lot_versions={'blank-lot':3,'base-lot':2}).status_code==200


@pytest.mark.parametrize('change',[
    {'lot_versions':{}},{'lot_versions':{'blank-lot':1}},{'lot_versions':{'blank-lot':1,'base-lot':1,'extra':0}},
    {'lot_versions':{'blank-lot':0,'base-lot':1}},{'lot_versions':{'blank-lot':True,'base-lot':1}},
    {'reason':' '},{'reason':'x\ny'},{'actor':'admin'},
])
def test_reserve_rejects_versions_and_authority_changes(connected,monkeypatch,change):
    fixture(connected,monkeypatch)
    r=reserve(connected,**change)
    assert r.status_code in (409,422),r.text
    assert balances(connected,'blank-lot')['version']==1


def test_global_command_identity_in_both_directions_and_operations(connected,monkeypatch):
    fixture(connected,monkeypatch)
    request=reserve_body();hold=connected.post(BOM+'/reservations',json=request,headers=staff()).json()
    movement={'request_id':request['request_id'],'expected_version':2,'quantity':1,'purpose':'receipt','destination':bucket(),'reason':'Fixture receipt'}
    assert connected.post(BASE+'/lots/blank-lot/movements',json=movement,headers=staff()).status_code==409
    assert connected.post(BOM+'/reservations',json={**request,'reason':'changed'},headers=staff()).status_code==409
    assert transition(connected,hold,request_id=request['request_id']).status_code==409
    key=str(uuid4())
    movement.update(request_id=key)
    assert connected.post(BASE+'/lots/blank-lot/movements',json=movement,headers=staff()).status_code==200
    assert reserve(connected,request_id=key,lot_versions={'blank-lot':3,'base-lot':2}).status_code==409


def test_multicomponent_reservation_contention_has_single_winner(connected,monkeypatch):
    fixture(connected,monkeypatch)
    # Each requires all10 blanks and20 bases.
    payload=plan(quantity=10,allocations=[{'lot_id':'blank-lot','location_id':'shop','units':10},{'lot_id':'base-lot','location_id':'shop','units':20}])
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses=list(pool.map(lambda _:reserve(connected,**payload),range(5)))
    assert sorted(r.status_code for r in responses)==[200]+[409]*4
    with database() as db:
        assert db.execute("SELECT COUNT(*) FROM fixture_holds").fetchone()[0]==1
        assert db.execute("SELECT SUM(units) FROM fixture_allocations WHERE state='active'").fetchone()[0]==30


def test_release_consume_race_and_idempotent_restart(connected,monkeypatch):
    fixture(connected,monkeypatch)
    request=reserve_body();hold=connected.post(BOM+'/reservations',json=request,headers=staff()).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda action:transition(connected,hold,action),['release','consume']))
    assert sorted(r.status_code for r in responses)==[200,409]
    code="from services.commerce.app.workflows import database; import json,sys\nwith database() as d: print(d.execute('SELECT document FROM fixture_holds WHERE id=?',(sys.argv[1],)).fetchone()[0])"
    result=subprocess.run([sys.executable,'-c',code,hold['id']],capture_output=True,text=True,check=True,env=os.environ.copy())
    assert json.loads(result.stdout)['state'] in ('released','consumed')
    assert connected.post(BOM+'/reservations',json=request,headers=staff()).json()==hold


def test_reservation_final_audit_failure_rolls_back_all_components(connected,monkeypatch):
    fixture(connected,monkeypatch)
    with database() as db:
        db.execute("CREATE TRIGGER fail_hold_command BEFORE INSERT ON fixture_hold_commands BEGIN SELECT RAISE(ABORT,'injected'); END")
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        reserve(connected)
    assert balances(connected,'blank-lot')['version']==balances(connected,'base-lot')['version']==1
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_holds').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM fixture_allocations').fetchone()[0]==0


def test_consumption_final_component_overflow_rolls_back_everything(connected,monkeypatch):
    fixture(connected,monkeypatch);hold=reserve(connected).json()
    assert connected.post(BASE+'/lots/blank-lot/movements',json={'request_id':str(uuid4()),'expected_version':2,'quantity':1000000,'purpose':'receipt','destination':bucket(condition='in_production'),'reason':'Fixture target full'},headers=staff()).status_code==200
    before={lot:balances(connected,lot) for lot in ('blank-lot','base-lot')}
    assert transition(connected,hold,'consume',lot_versions={'blank-lot':3,'base-lot':2}).status_code==409
    assert {lot:balances(connected,lot) for lot in before}==before
    assert connected.get(BASE+'/reservations/'+hold['id'],headers=staff()).json()==hold
    with database() as db:
        assert db.execute("SELECT COUNT(*) FROM fixture_allocations WHERE state='active'").fetchone()[0]==2


def test_current_hold_snapshot_survives_new_bom_version_and_missing_rows_fail_closed(connected,monkeypatch):
    fixture(connected,monkeypatch);hold=reserve(connected).json()
    connected.put(BASE+'/boms/gift/versions/2',json=bill(components=[{'component_id':'blank','units_per_item':10}]),headers=staff())
    assert connected.get(BASE+'/reservations/'+hold['id'],headers=staff()).json()['bom']==hold['bom']
    with database() as db:
        db.execute("DELETE FROM fixture_allocations WHERE hold_id=? AND lot_id='base-lot'",(hold['id'],))
    assert transition(connected,hold).status_code==409
    assert balances(connected,'blank-lot')['version']==2


def test_disabled_auth_stage_and_extra_fields(connected,monkeypatch):
    assert connected.post(BOM+'/plan',json=plan(),headers=staff()).status_code==503
    fixture(connected,monkeypatch);hold=reserve(connected).json()
    for method,path,payload in [('get',BOM,None),('put',BOM,bill()),('post',BOM+'/plan',plan()),('post',BOM+'/reservations',reserve_body()),('get',BASE+'/reservations/'+hold['id'],None),('post',BASE+'/reservations/'+hold['id']+'/release',transition_body())]:
        r=getattr(connected,method)(path,**({'json':payload} if payload is not None else {}))
        assert r.status_code==401
    monkeypatch.setenv('SONORAN_STAGE','production')
    assert connected.post(BOM+'/plan',json=plan(),headers=staff()).status_code==503
    assert transition(connected,hold).status_code==503


def test_one_hold_consumption_preserves_other_hold_and_snapshot(connected,monkeypatch):
    fixture(connected,monkeypatch)
    first=reserve(connected).json()
    second=reserve(connected,lot_versions={'blank-lot':2,'base-lot':2}).json()
    assert second['state']=='active'
    assert transition(connected,first,'consume',lot_versions={'blank-lot':3,'base-lot':3}).status_code==200
    remaining=connected.get(BASE+'/reservations/'+second['id'],headers=staff()).json()
    assert remaining==second
    p=connected.post(BOM+'/plan',json=plan(),headers=staff()).json()
    assert [a['reserved_units'] for a in p['allocations']]==[4,2]
    assert transition(connected,second,'release',lot_versions={'blank-lot':4,'base-lot':4}).status_code==200


def test_split_component_across_lots_is_exact_and_versions_complete(connected,monkeypatch):
    fixture(connected,monkeypatch)
    assert connected.put(BASE+'/lots/blank-other',json={'component_id':'blank','supplier_reference':'fixture','lot_reference':'other'},headers=staff()).status_code==200
    assert connected.post(BASE+'/lots/blank-other/movements',json={'request_id':str(uuid4()),'expected_version':0,'quantity':5,'purpose':'receipt','destination':bucket(),'reason':'Fixture receipt'},headers=staff()).status_code==200
    allocations=[{'lot_id':'blank-lot','location_id':'shop','units':1},{'lot_id':'blank-other','location_id':'shop','units':1},{'lot_id':'base-lot','location_id':'shop','units':4}]
    r=reserve(connected,allocations=allocations,lot_versions={'blank-lot':1,'blank-other':1,'base-lot':1})
    assert r.status_code==200,r.text
    h=r.json()
    assert transition(connected,h,'consume',lot_versions={'blank-lot':2,'blank-other':2,'base-lot':2}).status_code==200
    assert sum(x['units'] for x in balances(connected,'blank-other')['balances'])==5


def test_per_lot_reservation_audit_is_bounded_and_replay_appends_nothing(connected,monkeypatch):
    fixture(connected,monkeypatch)
    request=reserve_body();hold=connected.post(BOM+'/reservations',json=request,headers=staff()).json()
    connected.post(BOM+'/reservations',json=request,headers=staff())
    assert transition(connected,hold,'consume').status_code==200
    url=BASE+'/lots/blank-lot/reservation-events'
    page=connected.get(url+'?limit=1',headers=staff()).json()
    assert len(page['events'])==1 and page['events'][0]['state']=='active'
    assert page['events'][0]['lot_version']==2
    final=connected.get(url,params={'after':page['next_after'],'limit':1},headers=staff()).json()
    assert len(final['events'])==1 and final['events'][0]['state']=='consumed'
    assert final['events'][0]['lot_version']==3 and final['next_after'] is None
    assert final['events'][0]['audit']['actor']=='synthetic_staff'
    assert connected.get(url).status_code==401
    assert connected.get(url+'?limit=101',headers=staff()).status_code==422
    assert connected.get(url+'?after=9223372036854775808',headers=staff()).status_code==422


def test_last_per_lot_audit_insert_failure_rolls_back_hold_and_both_lots(connected,monkeypatch):
    fixture(connected,monkeypatch)
    with database() as db:
        db.execute("CREATE TRIGGER fail_last_hold_audit BEFORE INSERT ON fixture_hold_events WHEN NEW.lot_id='blank-lot' BEGIN SELECT RAISE(ABORT,'injected'); END")
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        reserve(connected)
    for lot in ('blank-lot','base-lot'):
        assert balances(connected,lot)['version']==1
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_hold_commands').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM fixture_hold_events').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM fixture_allocations').fetchone()[0]==0
