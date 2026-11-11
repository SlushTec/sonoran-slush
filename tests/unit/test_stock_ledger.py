from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
from uuid import uuid4

import pytest
from test_commerce_workflows import connected, staff
from services.commerce.app.workflows import database

BASE = '/v1/admin/retail-test/component-ledger'


def init(c, monkeypatch):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED', 'true')
    assert c.put(BASE+'/components/blank', json={'kind':'blank','unit':'piece'}, headers=staff()).status_code == 200
    for loc, kind in [('shop','workshop'),('market','market')]:
        assert c.put(BASE+'/locations/'+loc,json={'kind':kind},headers=staff()).status_code == 200
    assert c.put(BASE+'/lots/lot',json={'component_id':'blank','supplier_reference':'fixture-supplier','lot_reference':'fixture-lot'},headers=staff()).status_code == 200


def bucket(loc='shop', condition='available'):
    return {'location_id':loc,'condition':condition}


def body(**changes):
    return {'request_id':str(uuid4()),'expected_version':0,'quantity':10,'purpose':'receipt','destination':bucket(),'reason':'Synthetic fixture receipt',**changes}


def move(c, **changes):
    return c.post(BASE+'/lots/lot/movements',json=body(**changes),headers=staff())


def state(c):
    r = c.get(BASE+'/lots/lot',headers=staff()); assert r.status_code == 200, r.text
    return r.json()


def test_immutable_definitions_and_explicit_non_checkout_authority(connected,monkeypatch):
    init(connected,monkeypatch)
    again=connected.put(BASE+'/components/blank',json={'kind':'blank','unit':'piece'},headers=staff())
    assert again.json()['checkout_authoritative'] is False and again.json()['test_mode'] is True
    assert connected.put(BASE+'/components/blank',json={'kind':'base','unit':'piece'},headers=staff()).status_code==409
    assert connected.put(BASE+'/locations/shop',json={'kind':'market'},headers=staff()).status_code==409
    assert connected.put(BASE+'/lots/lot',json={'component_id':'blank','supplier_reference':'other','lot_reference':'fixture-lot'},headers=staff()).status_code==409
    assert connected.put(BASE+'/lots/missing',json={'component_id':'missing','supplier_reference':'fixture','lot_reference':'fixture'},headers=staff()).status_code==409
    assert state(connected)['balances']==[]
    assert state(connected)['version']==0
    with database() as db:
        assert not db.execute("SELECT name FROM sqlite_master WHERE name='retail_stock'").fetchone()


@pytest.mark.parametrize('quantity',[True,False,0,-1,1.5,'1',1000001])
def test_strict_quantities(connected,monkeypatch,quantity):
    init(connected,monkeypatch)
    assert move(connected,quantity=quantity).status_code==422
    assert state(connected)['version']==0


@pytest.mark.parametrize('change',[
    {'expected_version':True},{'expected_version':-1},{'expected_version':'0'},
    {'reason':''},{'reason':'  '},{'reason':'line\nbreak'},{'reason':'a'*201},
    {'actor':'owner'}, {'checkout_authoritative':True},
    {'purpose':'transfer'}, {'purpose':'receipt','source':bucket()},
    {'purpose':'count_correction','source':bucket()},
    {'source':None,'destination':None}, {'destination':bucket(condition='reserved')},
    {'destination':{'location_id':'shop','condition':'available','version':1}},
])
def test_invalid_movement_shape_has_no_mutation(connected,monkeypatch,change):
    init(connected,monkeypatch)
    assert move(connected,**change).status_code==422
    assert state(connected)['version']==0 and state(connected)['balances']==[]


def test_atomic_transfer_conditions_and_audit(connected,monkeypatch):
    init(connected,monkeypatch)
    first=move(connected); assert first.status_code==200
    doc=first.json(); assert doc['actor']=='synthetic_staff' and doc['recorded_at']
    assert doc['checkout_authoritative'] is False and doc['test_mode'] is True
    assert move(connected,expected_version=1,quantity=4,purpose='transfer',source=bucket(),destination=bucket('market','sample')).status_code==200
    balances=state(connected)['balances']
    assert sum(b['units'] for b in balances)==10
    assert balances==[{'location_id':'market','condition':'sample','units':4},{'location_id':'shop','condition':'available','units':6}]
    # Cannot subtract more than exists; both legs and version remain unchanged.
    before=state(connected)
    assert move(connected,expected_version=2,quantity=7,purpose='transfer',source=bucket(),destination=bucket('market')).status_code==409
    assert state(connected)==before
    assert move(connected,expected_version=2,quantity=2,purpose='count_correction',source=bucket(),destination=None,reason='Fixture rejected at count').status_code==200
    assert sum(b['units'] for b in state(connected)['balances'])==8


def test_exact_replay_global_identity_and_stale_version(connected,monkeypatch):
    init(connected,monkeypatch); request=body()
    url=BASE+'/lots/lot/movements'
    a=connected.post(url,json=request,headers=staff()); assert a.status_code==200
    assert connected.post(url,json=request,headers=staff()).json()==a.json()
    assert move(connected).status_code==409
    assert connected.post(url,json={**request,'reason':'different'},headers=staff()).status_code==409
    assert connected.post(BASE+'/lots/other/movements',json=request,headers=staff()).status_code==409
    assert state(connected)['version']==1 and state(connected)['balances'][0]['units']==10


def test_gates_auth_unknowns_and_privacy(connected,monkeypatch):
    assert connected.get(BASE+'/lots/lot',headers=staff()).status_code==503
    init(connected,monkeypatch)
    for method,path,data in [('get','/lots/lot',None),('get','/lots/lot/movements',None),('put','/locations/x',{'kind':'market'}),('post','/lots/lot/movements',body())]:
        r=getattr(connected,method)(BASE+path,**({'json':data} if data is not None else {}))
        assert r.status_code==401
    assert connected.get(BASE+'/lots/missing',headers=staff()).status_code==404
    assert move(connected,destination=bucket('missing')).status_code==409
    assert connected.get(BASE+'/lots/lot/movements?limit=101',headers=staff()).status_code==422
    assert connected.get(BASE+'/lots/lot/movements?after=9223372036854775808',headers=staff()).status_code==422
    assert connected.get(BASE+'/lots/lot?offset=-1',headers=staff()).status_code==422
    monkeypatch.setenv('SONORAN_STAGE','production')
    assert connected.get(BASE+'/lots/lot',headers=staff()).status_code==503
    assert connected.post(BASE+'/lots/lot/movements',json=body(),headers=staff()).status_code==503
    assert connected.get('/ready').status_code==503


def test_history_pagination_and_replay_is_not_new_movement(connected,monkeypatch):
    init(connected,monkeypatch)
    for version in range(3):
        assert move(connected,expected_version=version).status_code==200
    first=connected.get(BASE+'/lots/lot/movements?limit=2',headers=staff()).json()
    assert len(first['movements'])==2 and first['next_after']
    tail=connected.get(BASE+'/lots/lot/movements',params={'after':first['next_after'],'limit':2},headers=staff()).json()
    assert len(tail['movements'])==1 and tail['next_after'] is None
    assert len({m['request_id'] for m in first['movements']+tail['movements']})==3


def test_simultaneous_last_units_and_identical_request(connected,monkeypatch):
    init(connected,monkeypatch)
    request=body(quantity=1)
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses=list(pool.map(lambda _:connected.post(BASE+'/lots/lot/movements',json=request,headers=staff()),range(5)))
    assert all(r.status_code==200 for r in responses)
    assert len({r.json()['recorded_at'] for r in responses})==1
    def consume(_):
        return move(connected,expected_version=1,quantity=1,purpose='transfer',source=bucket(),destination=bucket('market'))
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses=list(pool.map(consume,range(5)))
    assert sorted(r.status_code for r in responses)==[200]+[409]*4
    assert sum(b['units'] for b in state(connected)['balances'])==1


def test_overflow_second_leg_and_injected_audit_failure_roll_back(connected,monkeypatch):
    init(connected,monkeypatch)
    assert move(connected,quantity=1000000).status_code==200
    assert move(connected,expected_version=1,quantity=1,destination=bucket('market')).status_code==200
    before=state(connected)
    assert move(connected,expected_version=2,quantity=1,purpose='transfer',source=bucket('market'),destination=bucket()).status_code==409
    assert state(connected)==before
    with database() as db:
        db.execute("CREATE TRIGGER fail_fixture_audit BEFORE INSERT ON fixture_movements BEGIN SELECT RAISE(ABORT,'injected'); END")
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        move(connected,expected_version=2,quantity=1,purpose='transfer',source=bucket(),destination=bucket('market'))
    assert state(connected)==before
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_movements').fetchone()[0]==2


def test_restart_reads_same_state_and_does_not_seed_retail(connected,monkeypatch):
    init(connected,monkeypatch); assert move(connected).status_code==200
    code="from services.commerce.app.workflows import database; import json\nwith database() as d: print(json.dumps([list(r) for r in d.execute('SELECT lot_id,location_id,condition,units FROM fixture_balances')]))"
    result=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True,check=True,env=os.environ.copy())
    assert json.loads(result.stdout)==[['lot','shop','available',10]]
    assert connected.get('/v1/retail-test/catalog').json()['offers']==[]
    assert connected.get('/v1/catalog').json()['production_approved'] is False


@pytest.mark.parametrize('kind',['blank','base','box','consumable'])
@pytest.mark.parametrize('unit',['piece','millilitre','gram','millimetre'])
def test_component_unit_definitions(connected,monkeypatch,kind,unit):
    monkeypatch.setenv('SONORAN_RETAIL_TEST_ENABLED','true')
    response=connected.put(BASE+'/components/test',json={'kind':kind,'unit':unit},headers=staff())
    assert response.status_code==200 and response.json()['unit']==unit


@pytest.mark.parametrize('condition',['available','damaged','sample','in_production','completed','shipped'])
def test_condition_buckets_remain_separate_fixture_counts(connected,monkeypatch,condition):
    init(connected,monkeypatch)
    assert move(connected,destination=bucket(condition=condition)).status_code==200
    assert state(connected)['balances']==[{'location_id':'shop','condition':condition,'units':10}]


def test_balance_pagination_and_checkout_independence(connected,monkeypatch):
    init(connected,monkeypatch)
    for index,condition in enumerate(['available','damaged','sample']):
        assert move(connected,expected_version=index,destination=bucket(condition=condition)).status_code==200
    p=connected.get(BASE+'/lots/lot?limit=2',headers=staff()).json()
    q=connected.get(BASE+'/lots/lot',params={'limit':2,'offset':p['next_offset']},headers=staff()).json()
    assert len(p['balances'])==2 and len(q['balances'])==1 and q['next_offset'] is None
    assert p['version']==q['version']==3
    assert connected.post('/v1/admin/retail-test/stock/shared',json={'expected_version':0,'on_hand':5},headers=staff()).status_code==200
    snapshot=state(connected)
    assert move(connected,expected_version=3,purpose='count_correction',quantity=3,source=bucket(),destination=None).status_code==200
    with database() as db:
        assert db.execute("SELECT on_hand,version FROM retail_stock WHERE id='shared'").fetchone()==(5,1)
        assert db.execute('SELECT COUNT(*) FROM retail_reservations').fetchone()[0]==0
    assert snapshot['balances'] != state(connected)['balances']


def test_cross_lot_replay_and_absent_location_have_no_partial_record(connected,monkeypatch):
    init(connected,monkeypatch)
    key=str(uuid4()); assert move(connected,request_id=key).status_code==200
    assert connected.put(BASE+'/lots/other',json={'component_id':'blank','supplier_reference':'fixture','lot_reference':'other'},headers=staff()).status_code==200
    assert connected.post(BASE+'/lots/other/movements',json=body(request_id=key),headers=staff()).status_code==409
    before=state(connected)
    assert move(connected,expected_version=1,purpose='transfer',quantity=3,source=bucket(),destination=bucket('unknown')).status_code==409
    assert before==state(connected)
    with database() as db:
        assert db.execute('SELECT COUNT(*) FROM fixture_movements').fetchone()[0]==1
        assert db.execute("SELECT version FROM fixture_lots WHERE id='other'").fetchone()[0]==0
