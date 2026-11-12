"""Actual ASGI synthetic count comparisons; all logical state must be unchanged."""
import json

import pytest

from test_commerce_workflows import connected, staff
from test_stock_ledger import BASE, init, move, bucket
from test_component_reservations import fixture, reserve
from test_admin_authorization_matrix import logical_state
from test_incoming_inspection import receive, inspect
from services.commerce.app.workflows import database

URL = BASE + "/lots/lot/count-preview"


def observation(location="shop", condition="available", units=0):
    return {"location_id": location, "condition": condition, "observed_units": units}


def request(version=1, observations=None):
    return {"expected_version": version,
            "observations": [observation()] if observations is None else observations}


def preview(c, body=None, url=URL):
    return c.post(url, json=request() if body is None else body, headers=staff())


def assert_unchanged(c, body, expected, url=URL):
    before = logical_state()
    response = preview(c, body, url)
    assert response.status_code == expected, response.text
    assert logical_state() == before
    return response


def seeded(c, monkeypatch):
    init(c, monkeypatch)
    assert move(c).status_code == 200


def test_explicit_partial_positive_negative_zero_and_empty_known_location(connected, monkeypatch):
    seeded(connected, monkeypatch)
    assert move(connected, expected_version=1, purpose="transfer", quantity=3,
                source=bucket(), destination=bucket("market","damaged")).status_code == 200
    data = request(2, [observation(units=5), observation("market","damaged",4),
                       observation("shop","sample",0)])
    result = assert_unchanged(connected, data, 200).json()
    assert result == {"lot_id":"lot", "component_id":"blank", "unit":"piece", "version":2,
        "observations":[
            {**data["observations"][0], "recorded_units":7, "variance_units":-2,
             "protected_reserved_units":0, "reservation_floor_conflict":False},
            {**data["observations"][1], "recorded_units":3, "variance_units":1,
             "protected_reserved_units":0, "reservation_floor_conflict":False},
            {**data["observations"][2], "recorded_units":0, "variance_units":0,
             "protected_reserved_units":0, "reservation_floor_conflict":False}],
        "scope":"explicit_buckets_only", "applied":False, "correction_authorized":False,
        "test_mode":True, "checkout_authoritative":False}
    # Omitted available market bucket does not appear or get counted as zero.
    assert len(result["observations"]) == 3
    assert assert_unchanged(connected, data, 200).json() == result


def test_unused_registered_location_and_empty_lot(connected, monkeypatch):
    init(connected, monkeypatch)
    response = assert_unchanged(connected, request(0,[observation("market",units=5)]),200).json()
    assert response["observations"][0]["recorded_units"] == 0
    assert response["observations"][0]["variance_units"] == 5


@pytest.mark.parametrize("observed,conflict", [(0,True),(1,True),(2,False),(3,False),(10,False)])
def test_reserved_floor_applies_only_to_available_bucket(connected, monkeypatch, observed, conflict):
    fixture(connected, monkeypatch)
    assert reserve(connected).status_code == 200
    data = request(2,[observation(units=observed),observation(condition="damaged")])
    result = assert_unchanged(connected,data,200,BASE+"/lots/blank-lot/count-preview").json()
    first, second = result["observations"]
    assert first["recorded_units"] == 10 and first["variance_units"] == observed-10
    assert first["protected_reserved_units"] == 2 and first["reservation_floor_conflict"] is conflict
    assert second["protected_reserved_units"] == 0 and second["reservation_floor_conflict"] is False
    assert result["correction_authorized"] is False


def test_intake_quarantine_and_rejections_are_not_available_balances(connected, monkeypatch):
    init(connected, monkeypatch)
    assert receive(connected).status_code == 200
    pending = assert_unchanged(connected,request(1),200).json()
    assert pending["observations"][0]["recorded_units"] == 0
    assert inspect(connected).status_code == 200
    complete = assert_unchanged(connected,request(2),200).json()
    assert complete["observations"][0]["recorded_units"] == 7


@pytest.mark.parametrize("value", [True,False,-1,1000001,1.5,"1",None])
def test_strict_observed_quantities(connected,monkeypatch,value):
    seeded(connected,monkeypatch)
    assert_unchanged(connected,request(observations=[observation(units=value)]),422)


@pytest.mark.parametrize("value", [True,False,-1,9223372036854775807,1.5,"1",None])
def test_strict_expected_version(connected,monkeypatch,value):
    seeded(connected,monkeypatch)
    assert_unchanged(connected,request(value),422)


@pytest.mark.parametrize("observations", [
    [], [observation()]*2, [observation()]*101,
    [{"location_id":"shop","condition":"reserved","observed_units":0}],
    [{"location_id":"shop","condition":"available","observed_units":0,"actor":"owner"}],
    [{"location_id":"../shop","condition":"available","observed_units":0}],
    [{"location_id":"","condition":"available","observed_units":0}],
    [{"location_id":"x"*101,"condition":"available","observed_units":0}],
    [None], ["bad"], None,
], ids=["empty","duplicate","overlimit","bad-condition","extra-field","path","empty-id","long-id","null-row","string-row","null"])
def test_bad_observation_shapes(connected,monkeypatch,observations):
    seeded(connected,monkeypatch)
    assert_unchanged(connected,{"expected_version":1,"observations":observations},422)


def test_extra_request_fields_and_stale_version(connected,monkeypatch):
    seeded(connected,monkeypatch)
    assert_unchanged(connected,{**request(),"apply":True},422)
    assert_unchanged(connected,request(0),409)
    assert_unchanged(connected,request(2),409)
    assert_unchanged(connected,request(),404,BASE+"/lots/missing/count-preview")
    assert_unchanged(connected,request(observations=[observation("missing")]),409)


@pytest.mark.parametrize("condition", ["available","damaged","sample","in_production","completed","shipped"])
def test_each_condition_and_unit_dimension_are_retained(connected,monkeypatch,condition):
    init(connected,monkeypatch)
    assert move(connected,quantity=1000000,destination=bucket(condition=condition)).status_code == 200
    result=assert_unchanged(connected,request(observations=[observation(condition=condition,units=0)]),200).json()
    assert result["observations"][0]["variance_units"] == -1000000
    assert result["unit"] == "piece"


def test_exact_hundred_buckets_and_positive_maximum(connected,monkeypatch):
    init(connected,monkeypatch)
    rows=[]
    for i in range(100):
        loc="count-"+str(i)
        assert connected.put(BASE+"/locations/"+loc,json={"kind":"workshop"},headers=staff()).status_code==200
        rows.append(observation(loc,units=1000000))
    result=assert_unchanged(connected,request(0,rows),200).json()
    assert len(result["observations"])==100
    assert all(x["variance_units"]==1000000 for x in result["observations"])


@pytest.mark.parametrize("table,identity", [("fixture_lots","lot"),("fixture_locations","shop"),("fixture_components","blank")])
def test_corrupt_definition_is_not_treated_as_zero(connected,monkeypatch,table,identity):
    seeded(connected,monkeypatch)
    with database() as db:
        db.execute("UPDATE "+table+" SET document=? WHERE id=?", (json.dumps({"id":identity}),identity))
    assert_unchanged(connected,request(),409)


def test_unknown_metadata_is_not_returned(connected,monkeypatch):
    seeded(connected,monkeypatch)
    with database() as db:
        raw=db.execute("SELECT document FROM fixture_lots WHERE id='lot'").fetchone()[0]
        doc=json.loads(raw); doc["private_cost"]="PRIVATE-COST-SENTINEL"
        db.execute("UPDATE fixture_lots SET document=? WHERE id='lot'",(json.dumps(doc),))
    assert "PRIVATE-COST-SENTINEL" not in assert_unchanged(connected,request(),200).text


def test_preview_does_not_relax_existing_writer_version_or_floor(connected,monkeypatch):
    fixture(connected,monkeypatch); assert reserve(connected).status_code==200
    url=BASE+"/lots/blank-lot/count-preview"
    assert_unchanged(connected,request(2,[observation(units=0)]),200,url)
    from test_stock_ledger import body
    correction=body(expected_version=2,purpose="count_correction",quantity=10,source=bucket(),destination=None)
    before=logical_state()
    response=connected.post(BASE+"/lots/blank-lot/movements",json=correction,headers=staff())
    assert response.status_code==409 and logical_state()==before


def test_missing_database_remains_missing(connected,monkeypatch,tmp_path):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED","true")
    path=tmp_path/"absent"/"preview.sqlite3"
    monkeypatch.setenv("SONORAN_DB_PATH",str(path))
    assert preview(connected).status_code == 404
    assert not path.parent.exists()


def test_empty_database_is_not_initialized(connected,monkeypatch,tmp_path):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED","true")
    path=tmp_path/"empty.sqlite3"; path.touch()
    monkeypatch.setenv("SONORAN_DB_PATH",str(path))
    assert preview(connected).status_code == 409
    assert path.read_bytes() == b""


@pytest.mark.parametrize("fault", ["missing","wrong","blob"])
def test_access_binding_is_not_repaired(connected,monkeypatch,fault):
    seeded(connected,monkeypatch)
    with database() as db:
        if fault=="missing":
            db.execute("DELETE FROM metadata WHERE key='access_secret_fingerprint'")
        else:
            db.execute("UPDATE metadata SET value=? WHERE key='access_secret_fingerprint'",
                       ("wrong" if fault=="wrong" else b"malformed-binding",))
    assert_unchanged(connected,request(),503 if fault=="wrong" else 409)


def test_readonly_context_cannot_write(connected,monkeypatch):
    seeded(connected,monkeypatch)
    from services.commerce.app.count_preview import count_database
    import sqlite3
    before=logical_state()
    with count_database() as db:
        with pytest.raises(sqlite3.OperationalError,match="readonly"):
            db.execute("DELETE FROM records")
    assert logical_state()==before


def test_nonpiece_dimension_preserved(connected,monkeypatch):
    init(connected,monkeypatch)
    assert connected.put(BASE+"/components/fluid",json={"kind":"consumable","unit":"millilitre"},headers=staff()).status_code==200
    assert connected.put(BASE+"/lots/fluid",json={"component_id":"fluid","supplier_reference":"fixture","lot_reference":"fluid"},headers=staff()).status_code==200
    result=assert_unchanged(connected,request(0,[observation(units=20)]),200,BASE+"/lots/fluid/count-preview").json()
    assert result["unit"]=="millilitre" and result["component_id"]=="fluid"
    assert result["observations"][0]["variance_units"]==20


def test_readonly_uri_escapes_spaces_and_hash(connected,monkeypatch,tmp_path):
    path=tmp_path/"space and # marker"/"count # fixture.sqlite3"
    monkeypatch.setenv("SONORAN_DB_PATH",str(path))
    seeded(connected,monkeypatch)
    assert_unchanged(connected,request(),200)


def test_read_transaction_retains_wal_snapshot_across_concurrent_commit(connected,monkeypatch):
    seeded(connected,monkeypatch)
    from services.commerce.app.count_preview import count_database
    with count_database() as reader:
        assert reader.execute("SELECT units FROM fixture_balances").fetchone()[0]==10
        with database() as writer:
            writer.execute("UPDATE fixture_balances SET units=9")
        assert reader.execute("SELECT units FROM fixture_balances").fetchone()[0]==10
    assert assert_unchanged(connected,request(),200).json()["observations"][0]["recorded_units"]==9
