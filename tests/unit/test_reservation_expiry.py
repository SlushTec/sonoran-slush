"""Synthetic-only deterministic hold expiry and late-payment recovery."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import os
import subprocess
import sys
from threading import Barrier, Event
from uuid import uuid4

import pytest

from services.commerce.app import retail
from services.commerce.app.main import app
from services.commerce.app.workflows import database, load, save
from test_commerce_workflows import connected, staff, auth, proof, order
from test_retail_durability import setup, cart, purchase, simulate, release, SLUG, OTHER

START = datetime(2030, 1, 1, tzinfo=timezone.utc)
DEADLINE = START + timedelta(minutes=1)


@pytest.fixture
def clock(connected):
    now = [START]
    app.dependency_overrides[retail.reservation_clock] = lambda: lambda: now[0]
    try:
        yield now
    finally:
        app.dependency_overrides.pop(retail.reservation_clock, None)


def hold(c, o, deadline=DEADLINE.isoformat(), **changes):
    return c.post("/v1/admin/retail-test/orders/" + o["id"] + "/hold-deadline",
                  json={"version": 1, "test_hold_expires_at": deadline, **changes},
                  headers=staff())


def expire(c, o, **changes):
    return c.post("/v1/admin/retail-test/orders/" + o["id"] + "/expire",
                  json={"version": 1, **changes}, headers=staff())


def cancel(c, o):
    return c.post("/v1/orders/" + o["id"] + "/cancel-test",
                  json={"version": 1}, headers=auth(o))


def doc(c, o):
    result = c.get("/v1/orders/" + o["id"], headers=auth(o))
    assert result.status_code == 200
    document = result.json()
    # GET adds a derived checkout capability that is not a persisted order field.
    document.pop("test_payment_available", None)
    return document


def reserve(c, monkeypatch, count=1):
    setup(c, monkeypatch, count=count)
    result = purchase(c, cart(c))
    assert result.status_code == 200
    o = result.json()
    assert hold(c, o).status_code == 200
    return o


def rows(o):
    with database() as db:
        return db.execute(
            "SELECT stock_id,units,state FROM retail_reservations WHERE order_id=? ORDER BY stock_id",
            (o["id"],),
        ).fetchall()


def test_exact_deadline_and_expiry_cancel_replays(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    before = doc(connected, o)
    clock[0] = DEADLINE - timedelta(microseconds=1)
    assert expire(connected, o).status_code == 409
    assert doc(connected, o) == before
    clock[0] = DEADLINE
    result = expire(connected, o)
    assert result.status_code == 200
    expired = result.json()
    assert expired["status"] == "reservation_expired"
    assert expired["reservation_status"] == "expired"
    assert expired["reservation_expired_at"] == DEADLINE.isoformat()
    assert expired["payment_status"] == "unpaid"
    assert expired["inventory_reserved"] is False
    assert rows(o) == [("shared", 1, "released")]
    assert expire(connected, o).json() == expired
    assert cancel(connected, o).json() == expired
    assert hold(connected, o).json() == expired
    with database() as db:
        assert db.execute("SELECT on_hand,version FROM retail_stock WHERE id='shared'").fetchone() == (1, 1)
    assert purchase(connected, cart(connected)).status_code == 200


def test_deadline_is_immutable_and_offset_replay_is_exact(connected, monkeypatch, clock):
    setup(connected, monkeypatch)
    o = purchase(connected, cart(connected)).json()
    first = hold(connected, o, "2030-01-01T02:01:00+02:00")
    assert first.status_code == 200
    assert first.json()["test_hold_expires_at"] == DEADLINE.isoformat()
    assert hold(connected, o).json() == first.json()
    assert hold(connected, o, (DEADLINE + timedelta(days=1)).isoformat()).status_code == 409
    assert hold(connected, o, (DEADLINE - timedelta(seconds=1)).isoformat()).status_code == 409
    assert hold(connected, o, version=2).status_code == 409
    assert doc(connected, o) == first.json()


@pytest.mark.parametrize("value", [
    None, True, 1893456060, 1893456060.0, "1893456060",
    "", "2030-01-01", "2030-01-01T00:01:00", "tomorrow", "not-T-a-date",
], ids=["null", "bool", "epoch-int", "epoch-float", "epoch-string", "empty",
        "date-only", "naive", "word", "invalid"])
def test_deadline_requires_explicit_aware_iso_string(connected, monkeypatch, clock, value):
    setup(connected, monkeypatch)
    o = purchase(connected, cart(connected)).json()
    assert hold(connected, o, value).status_code == 422
    assert "test_hold_expires_at" not in doc(connected, o)
    assert rows(o) == [("shared", 1, "active")]


@pytest.mark.parametrize("delta", [0, -1])
def test_new_deadline_must_be_future(connected, monkeypatch, clock, delta):
    setup(connected, monkeypatch)
    o = purchase(connected, cart(connected)).json()
    assert hold(connected, o, (START + timedelta(seconds=delta)).isoformat()).status_code == 409


def test_no_implicit_duration_or_legacy_migration(connected, monkeypatch, clock):
    setup(connected, monkeypatch)
    o = purchase(connected, cart(connected)).json()
    assert "test_hold_expires_at" not in doc(connected, o)
    with database() as db:
        prior_schema = db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
    clock[0] = START + timedelta(days=365)
    assert expire(connected, o).status_code == 409
    assert simulate(connected, o).json()["applied"] is True
    assert expire(connected, o).status_code == 409
    legacy = order(connected)
    assert hold(connected, legacy, (clock[0] + timedelta(days=1)).isoformat()).status_code == 409
    assert expire(connected, legacy).status_code == 409
    with database() as db:
        assert db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").fetchall() == prior_schema


def test_new_routes_keep_auth_stage_and_body_gates(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    for action, payload in [
        ("hold-deadline", {"version": 1, "test_hold_expires_at": DEADLINE.isoformat()}),
        ("expire", {"version": 1}),
    ]:
        url = "/v1/admin/retail-test/orders/" + o["id"] + "/" + action
        assert connected.post(url, json=payload).status_code == 401
        assert connected.post(url, json=payload, headers=auth(o)).status_code == 401
        assert connected.post(url, json={**payload, "now": DEADLINE.isoformat()}, headers=staff()).status_code == 422
        assert connected.post(url, json={**payload, "version": True}, headers=staff()).status_code == 422
        monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "false")
        assert connected.post(url, json=payload, headers=staff()).status_code == 503
        monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
        monkeypatch.setenv("SONORAN_STAGE", "production")
        assert connected.post(url, json=payload, headers=staff()).status_code == 503
        monkeypatch.setenv("SONORAN_STAGE", "scaffold")
    assert expire(connected, o, version=2).status_code == 409
    assert rows(o) == [("shared", 1, "active")]
    assert connected.get("/ready").status_code == 503
    assert all(not p["purchasable"] and p["price_minor"] is None
               for p in connected.get("/v1/catalog").json()["products"])


@pytest.mark.parametrize("payment_status", ["paid", "pending", "unknown", "reconciliation_required"])
def test_paid_or_ambiguous_payment_never_releases(connected, monkeypatch, clock, payment_status):
    o = reserve(connected, monkeypatch)
    with database() as db:
        current = load(db, o["id"])
        current["payment_status"] = payment_status
        save(db, current)
    clock[0] = DEADLINE
    before = doc(connected, o)
    assert expire(connected, o).status_code == 409
    assert cancel(connected, o).status_code == 409
    assert doc(connected, o) == before
    assert rows(o) == [("shared", 1, "active")]
    assert purchase(connected, cart(connected)).status_code == 409


@pytest.mark.parametrize("binding", ["checkout_session_id", "payment_provider", "square_sessions", "square_payments"])
def test_provider_linkage_cannot_be_silently_released_or_simulated(connected, monkeypatch, clock, binding):
    o = reserve(connected, monkeypatch)
    with database() as db:
        if binding.startswith("square_"):
            from services.commerce.app.payments import schema
            schema(db)
            if binding == "square_sessions":
                db.execute("INSERT INTO square_sessions VALUES(?,?,?,?,?)",
                           ("synthetic-provider-order", o["id"], 1, "synthetic-link", "https://sandbox.square.link/u/synthetic"))
            else:
                db.execute("INSERT INTO square_payments VALUES(?,?)", ("synthetic-payment", o["id"]))
        else:
            current = load(db, o["id"])
            current[binding] = "unknown-synthetic-provider-binding"
            save(db, current)
    clock[0] = DEADLINE
    before = doc(connected, o)
    assert expire(connected, o).status_code == 409
    assert cancel(connected, o).status_code == 409
    assert simulate(connected, o).status_code == 409
    assert doc(connected, o) == before
    assert rows(o) == [("shared", 1, "active")]
    assert purchase(connected, cart(connected)).status_code == 409


@pytest.mark.parametrize("explicit_expiry", [False, True], ids=["payment-enforces-deadline", "already-expired"])
def test_late_payment_enters_sticky_recovery_not_production(connected, monkeypatch, clock, explicit_expiry):
    o = reserve(connected, monkeypatch)
    p = proof(connected, o)
    assert connected.post("/v1/proofs/" + p["id"] + "/approve",
                          json={"version": 1, "decision": "approve"}, headers=auth(p)).status_code == 200
    assert connected.post("/v1/admin/retail-test/orders/" + o["id"] + "/capacity",
                          json={"version": 1, "confirmed": True}, headers=staff()).status_code == 200
    clock[0] = DEADLINE
    if explicit_expiry:
        assert expire(connected, o).status_code == 200
        # The late payment must not steal the blank from a different buyer.
        assert purchase(connected, cart(connected)).status_code == 200
    identity = str(uuid4())
    late = simulate(connected, o, event_id=identity)
    assert late.status_code == 200
    assert late.json() == {"received": True, "applied": False, "test_mode": True, "recovery_required": True}
    recovery = doc(connected, o)
    assert recovery["payment_status"] == "reconciliation_required"
    assert recovery["status"] == "payment_reconciliation_required"
    assert recovery["payment_recovery_reason"] == "reservation_expired"
    assert recovery["reservation_status"] == "expired"
    assert recovery["inventory_reserved"] is False
    assert rows(o) == [("shared", 1, "released")]
    assert simulate(connected, o, event_id=identity).json() == late.json()
    assert simulate(connected, o, event_id=identity, outcome="failed").status_code == 409
    assert simulate(connected, o).json()["recovery_required"] is True
    assert simulate(connected, o, outcome="failed").json()["recovery_required"] is True
    assert doc(connected, o) == recovery
    assert expire(connected, o).json() == recovery
    assert cancel(connected, o).json() == recovery
    assert release(connected, o).status_code == 409
    assert connected.post("/v1/admin/retail-test/orders/" + o["id"] + "/capacity",
                          json={"version": 1, "confirmed": True}, headers=staff()).status_code == 409
    assert connected.post("/v1/admin/proofs", json={"order_id": o["id"], "expected_proof_version": 1,
                                                 "proof_text": "Synthetic revision"}, headers=staff()).status_code == 409
    assert connected.post("/v1/proofs/" + p["id"] + "/approve",
                          json={"version": 1, "decision": "approve"}, headers=auth(p)).status_code == 409
    with database() as db:
        assert db.execute("SELECT on_hand FROM retail_stock WHERE id='shared'").fetchone() == (1,)
        assert db.execute("SELECT COUNT(*) FROM payment_events WHERE order_id=?", (o["id"],)).fetchone() == (3,)


def test_payment_before_deadline_protects_hold_after_deadline(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    clock[0] = DEADLINE - timedelta(microseconds=1)
    identity = str(uuid4())
    paid = simulate(connected, o, event_id=identity)
    assert paid.json()["applied"] is True
    clock[0] = DEADLINE + timedelta(days=10)
    assert expire(connected, o).status_code == 409
    assert simulate(connected, o, event_id=identity).json()["applied"] is False
    assert doc(connected, o)["payment_status"] == "paid"
    assert rows(o) == [("shared", 1, "active")]
    assert purchase(connected, cart(connected)).status_code == 409
    assert release(connected, o).status_code == 409  # independent proof/capacity remain required


def test_invalid_late_event_does_not_expire_or_occupy_identity(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    clock[0] = DEADLINE
    identity = str(uuid4())
    before = doc(connected, o)
    for change in ({"version": 2}, {"amount_minor": 1}, {"currency": "EUR"}, {"outcome": "pending"}):
        assert simulate(connected, o, event_id=identity, **change).status_code in (409, 422)
    assert doc(connected, o) == before
    assert rows(o) == [("shared", 1, "active")]
    assert simulate(connected, o, event_id=identity).json()["recovery_required"] is True


def test_failed_event_before_expiry_does_not_authorize_or_clear_recovery(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    failure_id = str(uuid4())
    assert simulate(connected, o, event_id=failure_id, outcome="failed").json()["applied"] is False
    clock[0] = DEADLINE
    assert expire(connected, o).status_code == 200
    assert simulate(connected, o, event_id=failure_id, outcome="failed").json()["recovery_required"] is False
    assert simulate(connected, o).json()["recovery_required"] is True
    assert simulate(connected, o, event_id=failure_id, outcome="failed").json()["recovery_required"] is True
    assert doc(connected, o)["payment_status"] == "reconciliation_required"


def component_order(c, monkeypatch):
    setup(c, monkeypatch, count=3)
    assert c.post("/v1/admin/retail-test/stock/box",
                  json={"expected_version": 0, "on_hand": 2}, headers=staff()).status_code == 200
    assert c.post("/v1/admin/retail-test/offers/" + OTHER,
                  json={"expected_version": 1, "unit_price_minor": 1234,
                        "stock_id": "box", "units_per_item": 2}, headers=staff()).status_code == 200
    result = c.post("/v1/cart", json={"request_id": str(uuid4()), "items": [
        {"product_slug": SLUG, "quantity": 2}, {"product_slug": SLUG, "quantity": 1},
        {"product_slug": OTHER, "quantity": 1},
    ]})
    assert result.status_code == 200
    o = purchase(c, result.json()).json()
    assert hold(c, o).status_code == 200
    return o


def test_all_components_release_exactly_once_without_stock_increment(connected, monkeypatch, clock):
    o = component_order(connected, monkeypatch)
    assert rows(o) == [("box", 2, "active"), ("shared", 3, "active")]
    clock[0] = DEADLINE
    assert expire(connected, o).status_code == 200
    assert rows(o) == [("box", 2, "released"), ("shared", 3, "released")]
    assert cancel(connected, o).status_code == 200
    assert expire(connected, o).status_code == 200
    with database() as db:
        assert db.execute("SELECT id,on_hand,version FROM retail_stock ORDER BY id").fetchall() == [
            ("box", 2, 1), ("shared", 3, 1)]
    assert purchase(connected, cart(connected, qty=3)).status_code == 200
    assert purchase(connected, cart(connected, slug=OTHER)).status_code == 200
    assert purchase(connected, cart(connected)).status_code == 409


@pytest.mark.parametrize("corruption", ["missing-component", "wrong-units", "unexpected-component", "bad-deadline"])
def test_incomplete_or_corrupt_hold_is_not_partially_released(connected, monkeypatch, clock, corruption):
    o = component_order(connected, monkeypatch)
    with database() as db:
        if corruption == "missing-component":
            db.execute("DELETE FROM retail_reservations WHERE order_id=? AND stock_id='box'", (o["id"],))
        elif corruption == "wrong-units":
            db.execute("UPDATE retail_reservations SET units=1 WHERE order_id=? AND stock_id='box'", (o["id"],))
        elif corruption == "unexpected-component":
            db.execute("INSERT INTO retail_reservations VALUES(?, 'unknown', 1, 'active')", (o["id"],))
        else:
            current = load(db, o["id"])
            current["test_hold_expires_at"] = "not-a-deadline"
            save(db, current)
    prior_rows = rows(o)
    before = doc(connected, o)
    clock[0] = DEADLINE
    assert expire(connected, o).status_code == 409
    assert rows(o) == prior_rows
    assert doc(connected, o) == before


def test_expiry_and_recovery_rollback_with_event_write_failure(connected, monkeypatch, clock):
    o = component_order(connected, monkeypatch)
    clock[0] = DEADLINE
    before = doc(connected, o)
    original_save = retail.save

    def fail_recovery(db, record):
        if record.get("payment_recovery_reason") == "reservation_expired":
            raise RuntimeError("synthetic recovery write failure")
        return original_save(db, record)

    monkeypatch.setattr(retail, "save", fail_recovery)
    identity = str(uuid4())
    with pytest.raises(RuntimeError, match="synthetic recovery write failure"):
        simulate(connected, o, event_id=identity, amount_minor=4936)
    assert doc(connected, o) == before
    assert rows(o) == [("box", 2, "active"), ("shared", 3, "active")]
    with database() as db:
        assert db.execute("SELECT COUNT(*) FROM payment_events WHERE order_id=?", (o["id"],)).fetchone() == (0,)
    monkeypatch.setattr(retail, "save", original_save)
    assert simulate(connected, o, event_id=identity, amount_minor=4936).json()["recovery_required"] is True


def together(actions):
    gate = Barrier(len(actions))

    def run(action):
        gate.wait(timeout=10)
        return action()

    with ThreadPoolExecutor(max_workers=len(actions)) as pool:
        return list(pool.map(run, actions))


def test_expiry_cancellation_race_releases_once(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    clock[0] = DEADLINE
    responses = together([lambda: expire(connected, o)] * 4 + [lambda: cancel(connected, o)] * 4)
    assert all(r.status_code == 200 for r in responses)
    final = doc(connected, o)
    assert final["status"] in {"cancelled", "reservation_expired"}
    assert final["payment_status"] == "unpaid"
    assert rows(o) == [("shared", 1, "released")]
    labels = [entry["label"] for entry in final["timeline"]]
    assert sum(label in {"Test order cancelled and reservation released",
                         "Synthetic hold expired and exact reservation released"} for label in labels) == 1
    assert purchase(connected, cart(connected)).status_code == 200
    assert purchase(connected, cart(connected)).status_code == 409


def test_expiry_payment_race_always_recovers_at_deadline(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    clock[0] = DEADLINE
    identity = str(uuid4())
    responses = together([lambda: expire(connected, o)] * 4
                         + [lambda: simulate(connected, o, event_id=identity)] * 4)
    assert all(r.status_code == 200 for r in responses)
    assert doc(connected, o)["payment_status"] == "reconciliation_required"
    assert rows(o) == [("shared", 1, "released")]
    with database() as db:
        assert db.execute("SELECT COUNT(*) FROM payment_events WHERE order_id=?", (o["id"],)).fetchone() == (1,)
    assert release(connected, o).status_code == 409
    assert purchase(connected, cart(connected)).status_code == 200


def test_expiry_buyers_and_late_payment_cannot_oversell(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    buyers = [cart(connected, slug=SLUG if i % 2 else OTHER) for i in range(6)]
    clock[0] = DEADLINE
    actions = [lambda: expire(connected, o), lambda: simulate(connected, o)]
    actions += [lambda buyer=buyer: purchase(connected, buyer) for buyer in buyers]
    responses = together(actions)
    assert responses[0].status_code == responses[1].status_code == 200
    assert all(r.status_code in (200, 409) for r in responses[2:])
    # Buyers racing before the release may fail; retry each after the race.
    retried = [purchase(connected, buyer) for buyer in buyers]
    winners = {r.json()["id"] for r in retried if r.status_code == 200}
    assert len(winners) == 1
    assert doc(connected, o)["payment_status"] == "reconciliation_required"
    with database() as db:
        assert db.execute("SELECT on_hand FROM retail_stock WHERE id='shared'").fetchone() == (1,)
        assert db.execute("SELECT COALESCE(SUM(units),0) FROM retail_reservations WHERE state='active'").fetchone() == (1,)
        assert db.execute("SELECT COUNT(*) FROM retail_reservations WHERE order_id=? AND state='active'", (o["id"],)).fetchone() == (0,)


def test_clock_is_sampled_after_transaction_lock_not_request_start(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    resolved = Event()

    def dependency():
        resolved.set()
        return lambda: clock[0]

    app.dependency_overrides[retail.reservation_clock] = dependency
    with ThreadPoolExecutor(max_workers=1) as pool:
        with database():
            pending = pool.submit(expire, connected, o)
            assert resolved.wait(timeout=10)
            # The request has resolved dependencies but cannot own BEGIN IMMEDIATE
            # until this independent transaction releases its lock.
            clock[0] = DEADLINE
        result = pending.result(timeout=20)
    assert result.status_code == 200
    assert result.json()["reservation_expired_at"] == DEADLINE.isoformat()


def test_cart_retry_after_expiry_never_reacquires_stock(connected, monkeypatch, clock):
    setup(connected, monkeypatch, count=1)
    original_cart = cart(connected)
    o = purchase(connected, original_cart).json()
    assert hold(connected, o).status_code == 200
    clock[0] = DEADLINE
    assert expire(connected, o).status_code == 200
    replacement = purchase(connected, cart(connected)).json()
    retry = purchase(connected, original_cart)
    assert retry.status_code == 200 and retry.json()["id"] == o["id"]
    assert rows(o) == [("shared", 1, "released")]
    assert rows(replacement) == [("shared", 1, "active")]


def test_deadline_expiry_and_recovery_survive_independent_processes(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    code = """
import json, sys
from datetime import datetime
from fastapi.testclient import TestClient
from services.commerce.app.main import app
from services.commerce.app.retail import reservation_clock
from services.commerce.app.workflows import access_token
app.dependency_overrides[reservation_clock] = lambda: lambda: datetime.fromisoformat(sys.argv[2])
headers = {'Authorization': 'Bearer test-only-staff-token-' + 'x'*40}
with TestClient(app) as c:
    response = c.post('/v1/admin/retail-test/orders/' + sys.argv[1] + '/' + sys.argv[3],
                      json=json.loads(sys.argv[4]), headers=headers)
    assert response.status_code == 200, response.text
    response = c.get('/v1/orders/' + sys.argv[1], headers={'Authorization': 'Bearer ' + access_token(sys.argv[1])})
    print(response.text)
"""

    def restarted(action, body):
        result = subprocess.run([sys.executable, "-c", code, o["id"], DEADLINE.isoformat(), action, json.dumps(body)],
                                check=True, capture_output=True, text=True, env=os.environ.copy(), timeout=30)
        return json.loads(result.stdout)

    expired = restarted("expire", {"version": 1})
    assert expired["test_hold_expires_at"] == DEADLINE.isoformat()
    assert expired["reservation_status"] == "expired"
    assert restarted("expire", {"version": 1}) == expired
    identity = str(uuid4())
    payload = {"event_id": identity, "version": 1, "amount_minor": 1234, "currency": "USD", "outcome": "paid"}
    recovery = restarted("payments", payload)
    assert recovery["payment_status"] == "reconciliation_required"
    assert restarted("payments", payload) == recovery
    assert rows(o) == [("shared", 1, "released")]
    assert release(connected, o).status_code == 409
    assert purchase(connected, cart(connected)).status_code == 200


def test_expiry_and_payment_race_across_restarted_processes(connected, monkeypatch, clock):
    o = reserve(connected, monkeypatch)
    code = """
import json, sys
from datetime import datetime
from fastapi.testclient import TestClient
from services.commerce.app.main import app
from services.commerce.app.retail import reservation_clock
app.dependency_overrides[reservation_clock] = lambda: lambda: datetime.fromisoformat(sys.argv[2])
with TestClient(app) as c:
    print('ready', flush=True)
    assert sys.stdin.readline().strip() == 'go'
    response = c.post('/v1/admin/retail-test/orders/' + sys.argv[1] + '/' + sys.argv[3],
                      json=json.loads(sys.argv[4]),
                      headers={'Authorization': 'Bearer test-only-staff-token-' + 'x'*40})
    print(json.dumps({'code': response.status_code, 'body': response.json()}), flush=True)
"""
    identity = str(uuid4())
    jobs = [
        ("expire", {"version": 1}),
        ("payments", {"event_id": identity, "version": 1, "amount_minor": 1234, "currency": "USD", "outcome": "paid"}),
    ]
    children = []
    try:
        for action, payload in jobs:
            children.append(subprocess.Popen(
                [sys.executable, "-u", "-c", code, o["id"], DEADLINE.isoformat(), action, json.dumps(payload)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, env=os.environ.copy(),
            ))
        with ThreadPoolExecutor(max_workers=2) as pool:
            ready = [pool.submit(child.stdout.readline) for child in children]
            assert [result.result(timeout=30).strip() for result in ready] == ["ready", "ready"]
            # Both fresh interpreters are ready. Release them against the same
            # SQLite file, exercising cross-process transaction serialization.
            results = [pool.submit(child.communicate, "go\n", timeout=30) for child in children]
            outputs = [result.result(timeout=35) for result in results]
        for child, (stdout, stderr) in zip(children, outputs):
            assert child.returncode == 0, stderr
            assert json.loads(stdout)["code"] == 200, stdout
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=10)
            for stream in (child.stdin, child.stdout, child.stderr):
                stream.close()
    assert doc(connected, o)["payment_status"] == "reconciliation_required"
    assert rows(o) == [("shared", 1, "released")]
    with database() as db:
        assert db.execute("SELECT COUNT(*) FROM payment_events WHERE order_id=?", (o["id"],)).fetchone() == (1,)
    assert purchase(connected, cart(connected)).status_code == 200
    assert purchase(connected, cart(connected)).status_code == 409


@pytest.mark.parametrize("field,value", [
    ("test_mode", False), ("retail_test", False), ("status", "unknown"),
], ids=["not-test", "not-retail", "unknown-order-state"])
def test_only_explicit_eligible_synthetic_records_expire(connected, monkeypatch, clock, field, value):
    o = reserve(connected, monkeypatch)
    with database() as db:
        current = load(db, o["id"])
        current[field] = value
        save(db, current)
    clock[0] = DEADLINE
    before = doc(connected, o)
    assert expire(connected, o).status_code == 409
    assert doc(connected, o) == before
    assert rows(o) == [("shared", 1, "active")]


@pytest.mark.parametrize("field", ["checkout_session_id", "payment_provider"])
@pytest.mark.parametrize("value", [None, ""], ids=["null", "empty"])
def test_incomplete_provider_metadata_remains_ambiguous(connected, monkeypatch, clock, field, value):
    o = reserve(connected, monkeypatch)
    with database() as db:
        current = load(db, o["id"])
        current[field] = value
        save(db, current)
    clock[0] = DEADLINE
    assert expire(connected, o).status_code == 409
    assert cancel(connected, o).status_code == 409
    assert simulate(connected, o).status_code == 409
    assert rows(o) == [("shared", 1, "active")]
