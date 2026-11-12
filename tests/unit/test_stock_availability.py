"""Read-only fixture inventory qualification; no real stock/provider data."""
from concurrent.futures import ThreadPoolExecutor
import copy
import json
from uuid import UUID, uuid4

import pytest
from test_commerce_workflows import connected, staff
from test_stock_ledger import BASE, init, move, bucket
from test_component_reservations import fixture, reserve, transition
from services.commerce.app.workflows import database
from services.commerce.app import stock_ledger as ledger
from services.commerce.app import component_reservations as reservations

CONDITIONS = ("available", "damaged", "sample", "in_production", "completed", "shipped")
ERROR = {"code": "VERSION_CONFLICT", "message": "Synthetic lot availability needs reconciliation.", "retryable": False}


def snapshot():
    with database() as db:
        return list(db.iterdump())


def read(c, lot="blank-lot", status=200, **params):
    before = snapshot()
    result = c.get(BASE + "/lots/" + lot + "/availability", params=params, headers=staff())
    assert result.status_code == status, result.text
    assert snapshot() == before, "Availability GET changed the logical database."
    if status == 409:
        assert result.json()["error"] == ERROR
        assert set(result.json()) == {"error", "request_id"}
        assert UUID(result.json()["request_id"])
    return result.json()


def hold_doc(hold_id, change):
    with database() as db:
        doc = json.loads(db.execute("SELECT document FROM fixture_holds WHERE id=?", (hold_id,)).fetchone()[0])
        change(doc)
        db.execute("UPDATE fixture_holds SET document=? WHERE id=?", (json.dumps(doc), hold_id))


def execute(sql, args=()):
    with database() as db:
        db.execute(sql, args)


def quantities(available=0, **changes):
    return {condition: changes.get(condition, available if condition == "available" else 0) for condition in CONDITIONS}


def entry(location="shop", available=10, reserved=0, **changes):
    return {"location_id": location, "condition_units": quantities(available, **changes),
            "reserved_units": reserved, "free_units": available - reserved}


def test_complete_typed_empty_read_without_creating_hold_namespace(connected, monkeypatch):
    init(connected, monkeypatch)
    assert read(connected, "lot") == {
        "lot_id": "lot", "component_id": "blank", "unit": "piece", "version": 0,
        "locations": [], "test_mode": True, "checkout_authoritative": False}
    with database() as db:
        assert db.execute("SELECT name FROM sqlite_master WHERE name='fixture_holds'").fetchone() is None


def test_physical_available_and_free_are_distinct_and_all_conditions_retained(connected, monkeypatch):
    fixture(connected, monkeypatch)
    first = reserve(connected).json()
    for version, condition in enumerate(CONDITIONS[1:], start=2):
        r = connected.post(BASE + "/lots/blank-lot/movements", json={
            "request_id": str(uuid4()), "expected_version": version, "quantity": version,
            "purpose": "receipt", "destination": bucket("shop", condition), "reason": "Synthetic condition"},
            headers=staff())
        assert r.status_code == 200, r.text
    result = read(connected)
    assert result == {"lot_id": "blank-lot", "component_id": "blank", "unit": "piece",
                      "version": 7, "locations": [entry(reserved=2, damaged=2, sample=3,
                      in_production=4, completed=5, shipped=6)], "test_mode": True,
                      "checkout_authoritative": False}
    assert first["state"] == "active"


@pytest.mark.parametrize("action", ["release", "consume"])
def test_multiple_holds_and_transitions_report_only_requested_lot(connected, monkeypatch, action):
    fixture(connected, monkeypatch)
    first = reserve(connected).json()
    second = reserve(connected, lot_versions={"blank-lot": 2, "base-lot": 2}).json()
    assert read(connected)["locations"] == [entry(reserved=4)]
    assert read(connected, "base-lot")["locations"] == [entry(available=20, reserved=8)]
    assert transition(connected, first, action, lot_versions={"blank-lot": 3, "base-lot": 3}).status_code == 200
    assert read(connected)["locations"] == [entry(available=8 if action == "consume" else 10,
        reserved=2, in_production=2 if action == "consume" else 0)]
    assert second["state"] == "active"


def test_transfer_count_correction_and_nonavailable_only_location(connected, monkeypatch):
    init(connected, monkeypatch)
    assert move(connected).status_code == 200
    assert move(connected, expected_version=1, quantity=3, purpose="transfer",
                source=bucket(), destination=bucket("market")).status_code == 200
    assert move(connected, expected_version=2, quantity=2, purpose="count_correction",
                source=bucket("market"), destination=None).status_code == 200
    assert move(connected, expected_version=3, quantity=1, purpose="transfer",
                source=bucket("market"), destination=bucket("market", "damaged")).status_code == 200
    assert read(connected, "lot")["locations"] == [
        entry("market", available=0, damaged=1), entry("shop", available=7)]


@pytest.mark.parametrize("version,status", [(1, 200), (0, 409), (2, 409)])
def test_expected_version_is_optional_read_cas_only(connected, monkeypatch, version, status):
    fixture(connected, monkeypatch)
    read(connected, expected_version=version, status=status)


@pytest.mark.parametrize("value", [-1, "bad", "1.1", 9223372036854775807])
def test_bad_query_versions_are_422(connected, monkeypatch, value):
    fixture(connected, monkeypatch)
    read(connected, expected_version=value, status=422)


def test_missing_lot_and_wholly_absent_namespace_are_404_without_initialization(connected, monkeypatch):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    read(connected, status=404)
    with database() as db:
        assert not db.execute("SELECT name FROM sqlite_master WHERE name LIKE 'fixture_%'").fetchall()
    init(connected, monkeypatch)
    read(connected, status=404)


@pytest.mark.parametrize("table", ["fixture_components", "fixture_locations", "fixture_lots",
                                   "fixture_balances", "fixture_movements", "fixture_holds",
                                   "fixture_allocations", "fixture_boms", "fixture_hold_commands",
                                   "fixture_hold_events"])
def test_partial_namespaces_fail_without_recreating_tables(connected, monkeypatch, table):
    fixture(connected, monkeypatch)
    execute("DROP TABLE " + table)
    read(connected, status=409)


@pytest.mark.parametrize("headers,expected", [({}, 401), ({"Authorization": "Bearer incorrect"}, 401)])
def test_staff_authorization_before_database_or_source(connected, monkeypatch, headers, expected):
    fixture(connected, monkeypatch)
    execute("UPDATE fixture_lots SET document='not-json'")
    before = snapshot()
    r = connected.get(BASE + "/lots/blank-lot/availability", headers=headers)
    assert r.status_code == expected
    assert snapshot() == before
    assert "not-json" not in r.text


@pytest.mark.parametrize("key,value", [("SONORAN_RETAIL_TEST_ENABLED", "false"),
                                      ("SONORAN_REQUESTS_ENABLED", "false"),
                                      ("SONORAN_STAGE", "production")])
def test_existing_enablement_and_stage_gates_retained(connected, monkeypatch, key, value):
    fixture(connected, monkeypatch)
    before = snapshot()
    with monkeypatch.context() as blocked:
        blocked.setenv(key, value)
        r = connected.get(BASE + "/lots/blank-lot/availability", headers=staff())
        assert r.status_code == 503
        assert r.json().get("locations") is None
    assert snapshot() == before


@pytest.mark.parametrize("table,field,value", [
    ("fixture_lots", "id", "different"), ("fixture_lots", "component_id", "missing"),
    ("fixture_lots", "test_mode", 1), ("fixture_lots", "checkout_authoritative", True),
    ("fixture_lots", "supplier_reference", "trailing\n"),
    ("fixture_components", "unit", "crate"), ("fixture_components", "kind", "madeup"),
    ("fixture_components", "id", "wrong"), ("fixture_locations", "kind", "unknown"),
    ("fixture_locations", "id", "wrong")])
def test_malformed_referenced_definitions_fail_generic(connected, monkeypatch, table, field, value):
    fixture(connected, monkeypatch)
    identity = {"fixture_lots": "blank-lot", "fixture_components": "blank",
                "fixture_locations": "shop"}[table]
    with database() as db:
        doc = json.loads(db.execute("SELECT document FROM " + table + " WHERE id=?", (identity,)).fetchone()[0])
        doc[field] = value
        db.execute("UPDATE " + table + " SET document=? WHERE id=?", (json.dumps(doc), identity))
    read(connected, status=409)


@pytest.mark.parametrize("raw", ["null", "[]", "1", "{", '{"id":"blank-lot","id":"wrong"}'])
def test_invalid_json_sources_fail(connected, monkeypatch, raw):
    fixture(connected, monkeypatch)
    execute("UPDATE fixture_lots SET document=? WHERE id='blank-lot'", (raw,))
    read(connected, status=409)


@pytest.mark.parametrize("corruption", ["missing-hold", "missing-row", "missing-other-lot-row",
    "row-units", "orphan-other-lot-row", "state-row", "state-doc", "identity-doc",
    "missing-location", "hold-only-location", "over-reserved", "unit-other-lot",
    "component-other-lot", "missing-other-lot", "duplicate-doc-allocation", "empty-allocations",
    "bool-doc-units", "text-doc-units", "float-doc-units", "negative-doc-units",
    "oversized-doc-units", "scope-doc", "bool-version", "missing-doc-field"])
def test_bidirectional_complete_hold_relationship_is_required(connected, monkeypatch, corruption):
    fixture(connected, monkeypatch)
    hold = reserve(connected).json()
    key = hold["id"]
    if corruption == "missing-hold":
        execute("DELETE FROM fixture_holds WHERE id=?", (key,))
    elif corruption == "missing-row":
        execute("DELETE FROM fixture_allocations WHERE hold_id=? AND lot_id='blank-lot'", (key,))
    elif corruption == "missing-other-lot-row":
        execute("DELETE FROM fixture_allocations WHERE hold_id=? AND lot_id='base-lot'", (key,))
    elif corruption == "row-units":
        execute("UPDATE fixture_allocations SET units=3 WHERE hold_id=? AND lot_id='blank-lot'", (key,))
    elif corruption == "orphan-other-lot-row":
        execute("INSERT INTO fixture_allocations VALUES(?, 'unknown-lot', 'shop', 1, 'active')", (key,))
    elif corruption == "state-row":
        execute("UPDATE fixture_allocations SET state='released' WHERE hold_id=?", (key,))
    elif corruption == "state-doc":
        hold_doc(key, lambda d: d.update(state="released"))
    elif corruption == "identity-doc":
        hold_doc(key, lambda d: d.update(id="different-hold"))
    elif corruption == "missing-location":
        execute("DELETE FROM fixture_locations WHERE id='shop'")
    elif corruption == "hold-only-location":
        execute("DELETE FROM fixture_balances WHERE lot_id='blank-lot'")
    elif corruption == "over-reserved":
        execute("UPDATE fixture_balances SET units=1 WHERE lot_id='blank-lot'")
    elif corruption == "unit-other-lot":
        hold_doc(key, lambda d: next(a for a in d["allocations"] if a["lot_id"] == "base-lot").update(unit="gram"))
    elif corruption == "component-other-lot":
        hold_doc(key, lambda d: next(a for a in d["allocations"] if a["lot_id"] == "base-lot").update(component_id="blank"))
    elif corruption == "missing-other-lot":
        execute("DELETE FROM fixture_lots WHERE id='base-lot'")
    elif corruption == "duplicate-doc-allocation":
        hold_doc(key, lambda d: d["allocations"].append(copy.deepcopy(d["allocations"][0])))
    elif corruption == "empty-allocations":
        hold_doc(key, lambda d: d.update(allocations=[]))
    elif corruption == "scope-doc":
        hold_doc(key, lambda d: d.update(checkout_authoritative=True))
    elif corruption == "bool-version":
        hold_doc(key, lambda d: d.update(version=True))
    elif corruption == "missing-doc-field":
        hold_doc(key, lambda d: d["allocations"][0].pop("unit"))
    else:
        value = {"bool-doc-units": True, "text-doc-units": "2", "float-doc-units": 2.0,
                 "negative-doc-units": -1, "oversized-doc-units": 1000001}[corruption]
        hold_doc(key, lambda d: d["allocations"][0].update(units=value))
    read(connected, status=409)


@pytest.mark.parametrize("sql", [
    "UPDATE fixture_balances SET condition='rejected' WHERE lot_id='blank-lot'",
    "UPDATE fixture_balances SET location_id='phantom' WHERE lot_id='blank-lot'",
    "UPDATE fixture_balances SET units=1.5 WHERE lot_id='blank-lot'",
    "DELETE FROM fixture_components WHERE id='blank'",
    "UPDATE fixture_lots SET version=-1 WHERE id='blank-lot'",
    "UPDATE fixture_lots SET version=1.5 WHERE id='blank-lot'",
])
def test_raw_balance_or_definition_damage_is_not_normalized(connected, monkeypatch, sql):
    fixture(connected, monkeypatch)
    execute(sql)
    read(connected, status=409)


def test_unknown_metadata_is_not_returned_and_read_does_not_rewrite_it(connected, monkeypatch):
    fixture(connected, monkeypatch)
    hold = reserve(connected).json()
    for table, identity in [("fixture_lots", "blank-lot"), ("fixture_components", "blank"),
                            ("fixture_locations", "shop"), ("fixture_holds", hold["id"])]:
        with database() as db:
            doc = json.loads(db.execute("SELECT document FROM " + table + " WHERE id=?", (identity,)).fetchone()[0])
            doc["private"] = {"order_id": "DO-NOT-RETURN", "supplier": "PRIVATE"}
            db.execute("UPDATE " + table + " SET document=? WHERE id=?", (json.dumps(doc), identity))
    result = read(connected)
    encoded = json.dumps(result)
    assert "DO-NOT-RETURN" not in encoded and "PRIVATE" not in encoded
    assert set(result) == {"lot_id", "component_id", "unit", "version", "locations",
                           "test_mode", "checkout_authoritative"}
    assert result["locations"] == [entry(reserved=2)]


def test_concurrent_repeated_reads_do_not_change_cas_replay_or_stock(connected, monkeypatch):
    fixture(connected, monkeypatch)
    before = snapshot()
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(lambda _: connected.get(BASE + "/lots/blank-lot/availability",
            headers=staff()).json(), range(8)))
    assert all(value == values[0] for value in values)
    assert snapshot() == before
    assert reserve(connected).status_code == 200
    assert reserve(connected).status_code == 409  # Original stale lot CAS remains effective.


def seed_holds(number):
    with database() as db:
        reservations.schema(db)
        for i in range(number):
            hold_id = "fixture_hold_" + str(i)
            a = {"lot_id": "blank-lot", "location_id": "shop", "units": 1,
                 "component_id": "blank", "unit": "piece"}
            doc = {"id": hold_id, "state": "released", "version": 2,
                   "allocations": [a], **ledger.SCOPE}
            db.execute("INSERT INTO fixture_holds VALUES(?,?)", (hold_id, json.dumps(doc)))
            db.execute("INSERT INTO fixture_allocations VALUES(?, 'blank-lot', 'shop', 1, 'released')", (hold_id,))


@pytest.mark.parametrize("number,status", [(1000, 200), (1001, 409)])
def test_global_hold_and_all_state_allocation_scan_bound(connected, monkeypatch, number, status):
    fixture(connected, monkeypatch)
    seed_holds(number)
    result = read(connected, status=status)
    if status == 200:
        assert result["locations"] == [entry()]


@pytest.mark.parametrize("number,status", [(100, 200), (101, 409)])
def test_location_limit_is_before_any_page_or_zero_filter(connected, monkeypatch, number, status):
    fixture(connected, monkeypatch)
    with database() as db:
        db.execute("DELETE FROM fixture_balances WHERE lot_id='blank-lot'")
        for i in range(number):
            key = "place_" + str(i)
            ledger.immutable(db, "fixture_locations", key, {"kind": "market"})
            # Every bucket is zero, and must still consume the complete-view bound.
            db.execute("INSERT INTO fixture_balances VALUES('blank-lot',?,'available',0)", (key,))
    result = read(connected, status=status)
    if status == 200:
        assert len(result["locations"]) == 100
        assert all(x["free_units"] == 0 for x in result["locations"])


def test_openapi_closed_response_and_default_gates(connected, monkeypatch):
    from services.commerce.app.main import app
    schema = app.openapi()
    operation = schema["paths"][BASE + "/lots/{lot_id}/availability"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("/LotAvailability")
    model = schema["components"]["schemas"]["LotAvailability"]
    assert model["additionalProperties"] is False
    assert model["properties"]["test_mode"]["const"] is True
    assert model["properties"]["checkout_authoritative"]["const"] is False


def test_hold_tables_without_any_ledger_are_partial_not_empty(connected, monkeypatch):
    fixture(connected, monkeypatch)
    with database() as db:
        for table in ("fixture_components", "fixture_locations", "fixture_lots",
                      "fixture_balances", "fixture_movements"):
            db.execute("DROP TABLE " + table)
    read(connected, status=409)


@pytest.mark.parametrize("bound", ["global-holds", "target-allocations"])
def test_scan_caps_are_independent_before_filtering(connected, monkeypatch, bound):
    fixture(connected, monkeypatch)
    seed_holds(1000)
    if bound == "global-holds":
        with database() as db:
            raw = db.execute("SELECT document FROM fixture_holds LIMIT 1").fetchone()[0]
            doc = json.loads(raw)
            doc["id"] = "unrelated_hold"
            doc["allocations"][0]["lot_id"] = "unrelated_lot"
            db.execute("INSERT INTO fixture_holds VALUES(?,?)", (doc["id"], json.dumps(doc)))
    else:
        # Still 1000 hold documents: overflow must be detected before interpreting the orphan.
        execute("INSERT INTO fixture_allocations VALUES('unrecorded', 'blank-lot', 'shop', 1, 'released')")
    read(connected, status=409)


@pytest.mark.parametrize("number,status", [(100, 200), (101, 409)])
def test_relevant_hold_complete_allocation_bound(connected, monkeypatch, number, status):
    fixture(connected, monkeypatch)
    with database() as db:
        reservations.schema(db)
        db.execute("DELETE FROM fixture_balances WHERE lot_id='blank-lot'")
        allocations = []
        for i in range(number):
            loc = "held_place_" + str(i)
            ledger.immutable(db, "fixture_locations", loc, {"kind": "market"})
            db.execute("INSERT INTO fixture_balances VALUES('blank-lot',?,'available',1)", (loc,))
            a = {"lot_id": "blank-lot", "location_id": loc, "units": 1,
                 "component_id": "blank", "unit": "piece"}
            allocations.append(a)
            db.execute("INSERT INTO fixture_allocations VALUES('fixture_limit_hold', 'blank-lot', ?, 1, 'active')", (loc,))
        doc = {"id": "fixture_limit_hold", "state": "active", "version": 1,
               "allocations": allocations, **ledger.SCOPE}
        db.execute("INSERT INTO fixture_holds VALUES('fixture_limit_hold',?)", (json.dumps(doc),))
    result = read(connected, status=status)
    if status == 200:
        assert len(result["locations"]) == 100
        assert all(x["reserved_units"] == 1 and x["free_units"] == 0 for x in result["locations"])


@pytest.mark.parametrize("extra,status", [(False, 200), (True, 409)])
def test_condition_row_limit_is_complete_not_truncated(connected, monkeypatch, extra, status):
    fixture(connected, monkeypatch)
    with database() as db:
        db.execute("DELETE FROM fixture_balances WHERE lot_id='blank-lot'")
        for i in range(100):
            loc = "full_" + str(i)
            ledger.immutable(db, "fixture_locations", loc, {"kind": "market"})
            for condition in CONDITIONS:
                db.execute("INSERT INTO fixture_balances VALUES('blank-lot',?,?,0)", (loc, condition))
        if extra:
            # 601st source row must fail before returning the first 600.
            ledger.immutable(db, "fixture_locations", "overflow", {"kind": "market"})
            db.execute("INSERT INTO fixture_balances VALUES('blank-lot','overflow','available',0)")
    result = read(connected, status=status)
    if status == 200:
        assert len(result["locations"]) == 100
        assert all(x["condition_units"] == quantities() for x in result["locations"])


@pytest.mark.parametrize("raw", ['{"id":"x","test_mode":true,"checkout_authoritative":false,"allocations":[]}',
    '{"id":"x","id":"x","test_mode":true,"checkout_authoritative":false}',
    'NaN', '{"test_mode":true,"checkout_authoritative":false,"value":NaN}', "x" * 262145],
    ids=["empty", "duplicate", "primitive-nan", "nested-nan", "oversize"])
def test_ambiguous_or_unbounded_hold_source_never_becomes_zero_reserved(connected, monkeypatch, raw):
    fixture(connected, monkeypatch)
    with database() as db:
        reservations.schema(db)
        db.execute("INSERT INTO fixture_holds VALUES('x',?)", (raw,))
    read(connected, status=409)
