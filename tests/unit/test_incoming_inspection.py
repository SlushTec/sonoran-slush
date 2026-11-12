from concurrent.futures import ThreadPoolExecutor
import json
import sqlite3
from uuid import uuid4

import pytest
from test_commerce_workflows import connected, staff
from test_stock_ledger import BASE, init, state, move, body as movement_body
from services.commerce.app.workflows import database

URL = BASE + '/intakes/intake'


def receipt(**changes):
    return {'request_id': str(uuid4()), 'expected_lot_version': 0,
            'lot_id': 'lot', 'location_id': 'shop', 'quantity': 10, **changes}


def inspection(**changes):
    return {'request_id': str(uuid4()), 'expected_lot_version': 1,
            'accepted_units': 7, 'rejected_units': 3, 'defect': 'chipped', **changes}


def receive(c, data=None):
    return c.post(URL, json=data or receipt(), headers=staff())


def inspect(c, data=None):
    return c.post(URL+'/inspection', json=data or inspection(), headers=staff())


def test_quarantine_partition_read_and_exact_historical_replay(connected, monkeypatch):
    init(connected, monkeypatch)
    req = receipt()
    pending = receive(connected, req)
    assert pending.status_code == 200
    assert state(connected)['balances'] == []
    assert state(connected)['version'] == 1
    cmd = inspection()
    done = inspect(connected, cmd)
    assert done.status_code == 200
    doc = done.json()
    assert doc['state'] == 'inspected' and doc['accepted_units'] == 7
    assert doc['rejected_units'] == 3 and doc['test_mode'] is True
    assert doc['checkout_authoritative'] is False and doc['actor'] == 'synthetic_staff'
    assert state(connected)['balances'] == [{'location_id':'shop','condition':'available','units':7}]
    assert state(connected)['version'] == 2
    assert receive(connected, req).json() == pending.json()
    assert inspect(connected, cmd).json() == doc
    assert connected.get(URL, headers=staff()).json() == doc
    assert inspect(connected, inspection(expected_lot_version=2)).status_code == 409
    assert state(connected)['version'] == 2


@pytest.mark.parametrize('accepted,rejected,defect', [(10,0,'none'),(0,10,'scratched')])
def test_all_accepted_or_rejected(connected, monkeypatch, accepted, rejected, defect):
    init(connected, monkeypatch); assert receive(connected).status_code == 200
    assert inspect(connected, inspection(accepted_units=accepted,rejected_units=rejected,defect=defect)).status_code == 200
    assert sum(x['units'] for x in state(connected)['balances']) == accepted


@pytest.mark.parametrize('change', [
    {'quantity':True},{'quantity':0},{'quantity':1000001},{'quantity':'10'},
    {'expected_lot_version':True},{'expected_lot_version':-1},
    {'expected_lot_version':9223372036854775807},{'actor':'owner'},
    {'checkout_authoritative':True},{'lot_id':'../bad'},
])
def test_receipt_invalid_no_mutation(connected, monkeypatch, change):
    init(connected, monkeypatch)
    assert receive(connected,receipt(**change)).status_code == 422
    assert state(connected)['version'] == 0


@pytest.mark.parametrize('change', [
    {'accepted_units':True},{'accepted_units':-1},{'accepted_units':'7'},
    {'rejected_units':1000001},{'accepted_units':1000000,'rejected_units':1},
    {'defect':'none'},{'rejected_units':0},{'expected_lot_version':True},
    {'actor':'owner'}, {'defect':'customer personal text'},
])
def test_inspection_invalid_no_mutation(connected, monkeypatch, change):
    init(connected, monkeypatch); receive(connected)
    assert inspect(connected,inspection(**change)).status_code == 422
    assert state(connected)['version'] == 1 and state(connected)['balances'] == []


def test_partition_stale_missing_and_identity_conflicts(connected, monkeypatch):
    init(connected, monkeypatch)
    assert inspect(connected).status_code == 404
    req = receipt(); receive(connected,req)
    assert receive(connected,receipt()).status_code == 409
    assert receive(connected,{**req,'quantity':11}).status_code == 409
    assert inspect(connected,inspection(accepted_units=6)).status_code == 409
    assert inspect(connected,inspection(expected_lot_version=0)).status_code == 409
    assert inspect(connected,inspection(request_id=req['request_id'])).status_code == 409
    assert move(connected,expected_version=1,request_id=req['request_id']).status_code == 409
    assert state(connected)['version'] == 1
    movement = movement_body(expected_version=1)
    assert connected.post(BASE+'/lots/lot/movements',json=movement,headers=staff()).status_code == 200
    assert inspect(connected,inspection(expected_lot_version=2,request_id=movement['request_id'])).status_code == 409


def test_auth_optin_production_and_read_does_not_initialize_intakes(connected, monkeypatch):
    assert receive(connected).status_code == 503
    init(connected, monkeypatch)
    assert connected.get(URL,headers=staff()).status_code == 404
    with database() as db:
        assert not db.execute("SELECT 1 FROM sqlite_master WHERE name='fixture_intakes'").fetchone()
    for path,data in [(URL,receipt()),(URL+'/inspection',inspection())]:
        assert connected.post(path,json=data).status_code == 401
    assert connected.get(URL).status_code == 401
    monkeypatch.setenv('SONORAN_STAGE','production')
    assert receive(connected).status_code == 503
    assert inspect(connected).status_code == 503
    assert connected.get(URL,headers=staff()).status_code == 503


def test_missing_location_and_lot_do_not_create_intake(connected, monkeypatch):
    init(connected, monkeypatch)
    assert receive(connected,receipt(location_id='missing')).status_code == 409
    assert receive(connected,receipt(lot_id='missing')).status_code == 404
    assert state(connected)['version'] == 0
    assert connected.get(URL,headers=staff()).status_code == 404


def test_parallel_replay_and_competing_inspections(connected, monkeypatch):
    init(connected, monkeypatch); req=receipt()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:receive(connected,req),range(4)))
    assert all(r.status_code == 200 for r in results)
    assert len({r.json()['received_at'] for r in results}) == 1
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:inspect(connected),range(4)))
    assert sorted(r.status_code for r in results) == [200,409,409,409]
    assert state(connected)['version'] == 2
    assert state(connected)['balances'][0]['units'] == 7


def test_overflow_and_command_audit_failure_roll_back(connected, monkeypatch):
    init(connected, monkeypatch)
    assert move(connected,quantity=1000000).status_code == 200
    assert receive(connected,receipt(expected_lot_version=1)).status_code == 200
    before=state(connected)
    assert inspect(connected,inspection(expected_lot_version=2)).status_code == 409
    assert state(connected) == before
    assert connected.get(URL,headers=staff()).json()['state'] == 'pending'
    # Clear only the synthetic balance to exercise an audit failure after credit.
    with database() as db:
        db.execute("UPDATE fixture_balances SET units=0")
        db.execute("CREATE TRIGGER fail_intake_audit BEFORE INSERT ON fixture_intake_commands BEGIN SELECT RAISE(ABORT,'injected'); END")
    before=state(connected)
    with pytest.raises(sqlite3.IntegrityError):
        inspect(connected,inspection(expected_lot_version=2))
    assert state(connected) == before
    assert connected.get(URL,headers=staff()).json()['state'] == 'pending'


@pytest.mark.parametrize('corruption', ['not json', '{}', 'identity', 'partition'])
def test_corrupt_record_fails_closed(connected, monkeypatch, corruption):
    init(connected,monkeypatch); pending=receive(connected).json()
    raw=corruption
    if corruption == 'identity':
        raw=json.dumps({**pending,'id':'other'})
    if corruption == 'partition':
        raw=json.dumps({**pending,'accepted_units':1})
    with database() as db:
        db.execute("UPDATE fixture_intakes SET document=?", (raw,))
    assert connected.get(URL,headers=staff()).status_code == 409
    assert inspect(connected).status_code == 409
    assert state(connected)['balances'] == []


def test_hold_command_identity_both_directions(connected,monkeypatch):
    from services.commerce.app.component_reservations import schema, command_replay
    from fastapi import HTTPException
    init(connected,monkeypatch); req=receipt(); receive(connected,req)
    with database() as db:
        schema(db)
        with pytest.raises(HTTPException) as error:
            command_replay(db, req['request_id'], {})
        assert error.value.status_code == 409
        hold_id=str(uuid4())
        db.execute("INSERT INTO fixture_hold_commands VALUES(?,?,?)",(hold_id,'fixture','{}'))
    assert inspect(connected,inspection(request_id=hold_id)).status_code == 409
    assert state(connected)['balances'] == []


def test_receipt_failure_rolls_back_identity_and_lot(connected,monkeypatch):
    from services.commerce.app.incoming_inspection import schema
    init(connected,monkeypatch)
    with database() as db:
        schema(db)
        db.execute("CREATE TRIGGER fail_receipt BEFORE INSERT ON fixture_intake_commands BEGIN SELECT RAISE(ABORT,'injected'); END")
    with pytest.raises(sqlite3.IntegrityError):
        receive(connected)
    assert state(connected)['version'] == 0
    assert connected.get(URL,headers=staff()).status_code == 404


def test_restart_and_simultaneous_exact_inspection_replay(connected,monkeypatch):
    import os
    import subprocess
    import sys
    init(connected,monkeypatch); receive(connected)
    command=inspection()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:inspect(connected,command),range(4)))
    assert all(r.status_code == 200 for r in results)
    assert len({r.json()['inspected_at'] for r in results}) == 1
    script = """from fastapi.testclient import TestClient
from services.commerce.app.main import app
import json,os
with TestClient(app) as c:
    r=c.get('/v1/admin/retail-test/component-ledger/intakes/intake',
      headers={'Authorization':'Bearer '+os.environ['SONORAN_STAFF_TOKEN']})
    assert r.status_code==200,r.text
    print(json.dumps(r.json()))
"""
    result=subprocess.run([sys.executable,'-c',script],env=os.environ.copy(),
                          text=True,capture_output=True,timeout=30,check=True)
    assert json.loads(result.stdout) == results[0].json()
    assert state(connected)['version'] == 2
