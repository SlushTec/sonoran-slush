from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import hmac
import json
import time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from services.commerce.app.main import app
from services.commerce.app import payments


@pytest.fixture()
def connected(tmp_path, monkeypatch):
    monkeypatch.setenv("SONORAN_REQUESTS_ENABLED", "true")
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", "test-only-access-secret-" + "x"*40)
    monkeypatch.setenv("SONORAN_STAFF_TOKEN", "test-only-staff-token-" + "x"*40)
    monkeypatch.setenv("SONORAN_DB_PATH", str(tmp_path/"commerce.sqlite3"))
    monkeypatch.setenv("SONORAN_TEST_PAYMENTS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_local_unit_fixture")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_fixture_only")
    monkeypatch.setenv("SONORAN_STOREFRONT_ORIGIN", "https://review.example.test")
    with TestClient(app) as client:
        yield client


def staff():
    return {"Authorization": "Bearer test-only-staff-token-" + "x"*40}


def auth(receipt):
    return {"Authorization": "Bearer "+receipt["access_token"]}


def inquiry(kind="retail"):
    return {"request_id":str(uuid4()), "kind":kind, "name":"Test Customer",
            "email":"test@example.test", "consent":True,
            "items":[{"product_slug":"makertwist-40oz-tumbler", "quantity":2,
                      "text":"Private inscription", "font":"Classic serif"}] if kind=="retail" else []}


def quote(c):
    r = c.post("/v1/quotes", json=inquiry())
    assert r.status_code == 200, r.text
    return r.json()


def offer_accept(c, q):
    r = c.post("/v1/admin/quotes/"+q["id"]+"/offer",
               json={"version":1,"total_minor":12345,"message":"Reviewed test quote, including all charges."},
               headers=staff())
    assert r.status_code == 200, r.text
    r = c.post("/v1/quotes/"+q["id"]+"/accept",
               json={"version":2,"decision":"accept"}, headers=auth(q))
    assert r.status_code == 200, r.text


def order(c):
    q = quote(c)
    offer_accept(c, q)
    result = c.post("/v1/admin/orders", json={"quote_id":q["id"],"version":2}, headers=staff())
    assert result.status_code == 200, result.text
    return result.json()


def proof(c, o, expected=0):
    r = c.post("/v1/admin/proofs", json={"order_id":o["id"],"expected_proof_version":expected,
              "proof_text":"Reviewed inscription version "+str(expected+1)}, headers=staff())
    assert r.status_code == 200, r.text
    return r.json()


def payment_event(oid, amount=12345, event_id="evt_local_test", paid=True):
    return {"id":event_id, "livemode":False, "type":"checkout.session.completed",
            "data":{"object":{"id":"cs_test_fixture","payment_status":"paid" if paid else "unpaid",
              "amount_total":amount, "currency":"usd", "client_reference_id":oid,
              "metadata":{"order_id":oid,"order_version":"1"}}}}


def send_event(c, payload, stamp=None, valid=True):
    raw = json.dumps(payload,separators=(",",":")).encode()
    stamp = int(time.time()) if stamp is None else stamp
    sig = hmac.new(b"whsec_test_fixture_only",str(stamp).encode()+b"."+raw,sha256).hexdigest()
    return c.post("/v1/webhooks/payments", content=raw, headers={
        "Stripe-Signature":f"t={stamp},v1={sig if valid else 'invalid'}",
        "Content-Type":"application/json"})


def session(c, o, monkeypatch):
    def fake(fields, key):
        assert fields["line_items[0][price_data][unit_amount]"] == "12345"
        assert fields["client_reference_id"] == o["id"]
        assert key == "sonoran:"+o["id"]+":1"
        return {"id":"cs_test_fixture", "url":"https://checkout.stripe.com/c/pay/cs_test_fixture"}
    monkeypatch.setattr(payments, "stripe_checkout", fake)
    response = c.post("/v1/checkout/sessions", json={"order_id":o["id"],"version":1}, headers=auth(o))
    assert response.status_code == 200, response.text
    assert response.json()["test_mode"] is True


def test_durable_private_record_survives_new_client(connected):
    q = quote(connected)
    with TestClient(app) as reopened:
        assert reopened.get("/v1/quotes/"+q["id"],headers=auth(q)).json()["items"][0]["text"] == "Private inscription"
        for headers in ({},{"Authorization":"Bearer wrong"}):
            r = reopened.get("/v1/quotes/"+q["id"],headers=headers)
            assert r.status_code == 404 and "Private inscription" not in r.text


def test_duplicate_request_replays_receipt_and_changed_retry_conflicts(connected):
    body = inquiry()
    one = connected.post("/v1/quotes",json=body)
    two = connected.post("/v1/quotes",json=body)
    assert one.json() == two.json()
    body["name"] = "A different customer"
    assert connected.post("/v1/quotes",json=body).status_code == 409
    counts = connected.get("/v1/admin/summary",headers=staff()).json()["counts"]
    assert counts == {"submitted":1}


def test_concurrent_duplicate_requests_create_one_record(connected):
    body = inquiry()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _:connected.post("/v1/quotes",json=body), range(4)))
    assert all(r.status_code==200 for r in results), [r.text for r in results]
    assert len({r.json()["id"] for r in results}) == 1


@pytest.mark.parametrize("change", [
    {"consent":False}, {"consent":"true"}, {"email":"bad email"},
    {"items":[{"product_slug":"not-a-product","quantity":1}]},
    {"items":[{"product_slug":"makertwist-40oz-tumbler","quantity":True}]},
    {"total_minor":1},
])
def test_invalid_or_client_priced_request_is_rejected_without_private_input(connected, change):
    body = inquiry()
    body.update(change)
    response = connected.post("/v1/quotes",json=body)
    assert response.status_code == 422
    assert "Private inscription" not in response.text and "test@example.test" not in response.text


def test_unsupported_crystal_is_rejected(connected):
    body = inquiry()
    body["items"] = [{"product_slug":"photo-crystal-collection","quantity":1,
                     "options":{"Crystal shape":"Prestige Iceberg medium","Size":"Medium"}}]
    assert connected.post("/v1/quotes",json=body).status_code == 422


def test_event_is_only_an_inquiry_and_cannot_become_retail_order(connected):
    q = connected.post("/v1/events/requests",json=inquiry("event")).json()
    assert q["status"] == "submitted"
    offer_accept(connected,q)
    assert connected.post("/v1/admin/orders",json={"quote_id":q["id"],"version":2},headers=staff()).status_code == 409


def test_guest_cannot_read_staff_data_or_set_prices(connected):
    q = quote(connected)
    assert connected.get("/v1/admin/summary",headers=auth(q)).status_code == 401
    assert connected.get("/v1/admin/records/"+q["id"],headers=auth(q)).status_code == 401
    assert connected.post("/v1/admin/quotes/"+q["id"]+"/offer",
           json={"version":1,"total_minor":1,"message":"not authorized"},headers=auth(q)).status_code == 401


def test_quote_revision_invalidates_old_version_acceptance(connected):
    q = quote(connected)
    offer_accept(connected,q)
    r = connected.post("/v1/admin/quotes/"+q["id"]+"/offer",
        json={"version":2,"total_minor":15000,"message":"Revised test quote"},headers=staff())
    assert r.json()["accepted_version"] is None and r.json()["version"] == 3
    assert connected.post("/v1/quotes/"+q["id"]+"/accept",
           json={"version":2,"decision":"accept"},headers=auth(q)).status_code == 409
    assert connected.post("/v1/admin/orders",json={"quote_id":q["id"],"version":2},headers=staff()).status_code == 409


def test_order_creation_is_idempotent(connected):
    q = quote(connected)
    offer_accept(connected,q)
    body = {"quote_id":q["id"],"version":2}
    first = connected.post("/v1/admin/orders",json=body,headers=staff())
    assert first.json() == connected.post("/v1/admin/orders",json=body,headers=staff()).json()


def test_approval_is_bound_to_exact_proof_and_revision_invalidates_it(connected):
    o = order(connected)
    p = proof(connected,o)
    assert connected.post("/v1/proofs/"+p["id"]+"/approve",json={"version":1,"decision":"approve"},headers=auth(p)).json()["status"] == "approved"
    proof(connected,o,1)
    doc = connected.get("/v1/orders/"+o["id"],headers=auth(o)).json()
    assert doc["approved_proof_version"] is None and doc["proof_status"] == "awaiting_approval"
    assert connected.post("/v1/proofs/"+p["id"]+"/approve",json={"version":1,"decision":"approve"},headers=auth(p)).status_code == 409


def test_proof_code_cannot_open_another_customers_order(connected):
    first,second = order(connected),order(connected)
    p = proof(connected,first)
    assert connected.get("/v1/orders/"+second["id"],headers=auth(first)).status_code == 404
    assert connected.get("/v1/orders/"+first["id"],headers=auth(p)).status_code == 404


def test_unpaid_order_cannot_be_released_even_with_approved_proof(connected):
    o = order(connected)
    p = proof(connected,o)
    connected.post("/v1/proofs/"+p["id"]+"/approve",json={"version":1,"decision":"approve"},headers=auth(p))
    body = {"version":1,"inventory_reserved":True,"capacity_confirmed":True}
    assert connected.post("/v1/admin/orders/"+o["id"]+"/release",json=body,headers=staff()).status_code == 409
    body["payment_rule_satisfied"] = True
    assert connected.post("/v1/admin/orders/"+o["id"]+"/release",json=body,headers=staff()).status_code == 422


def test_invalid_stale_live_and_mismatched_payment_events_do_not_pay(connected, monkeypatch):
    o = order(connected)
    session(connected,o,monkeypatch)
    event = payment_event(o["id"])
    assert send_event(connected,event,valid=False).status_code == 400
    assert send_event(connected,event,stamp=int(time.time())-301).status_code == 400
    event["livemode"] = True
    assert send_event(connected,event).status_code == 400
    event["livemode"] = False
    event["data"]["object"]["amount_total"] = 1
    assert send_event(connected,event).status_code == 409
    assert connected.get("/v1/orders/"+o["id"],headers=auth(o)).json()["payment_status"] == "unpaid"


def test_browser_cannot_override_checkout_total(connected):
    o = order(connected)
    assert connected.post("/v1/checkout/sessions",json={"order_id":o["id"],"version":1,"total_minor":1},headers=auth(o)).status_code == 422


def test_signed_paid_event_is_idempotent_and_does_not_release_production(connected, monkeypatch):
    o = order(connected)
    session(connected,o,monkeypatch)
    event = payment_event(o["id"])
    assert send_event(connected,event).json()["applied"] is True
    assert send_event(connected,event).json()["applied"] is False
    event["id"] = "evt_second_delivery"
    send_event(connected,event)
    data = connected.get("/v1/orders/"+o["id"],headers=auth(o)).json()
    assert data["payment_status"] == "paid"
    assert data["status"] != "in_production"
    assert len([x for x in data["timeline"] if "Payment verified" in x["label"]]) == 1


def test_full_local_payment_proof_release_dispatch_and_retry(connected, monkeypatch):
    o = order(connected)
    p = proof(connected,o)
    session(connected,o,monkeypatch)
    send_event(connected,payment_event(o["id"]))
    assert connected.post("/v1/admin/orders/"+o["id"]+"/release",
         json={"version":1,"inventory_reserved":True,"capacity_confirmed":True},headers=staff()).status_code == 409
    connected.post("/v1/proofs/"+p["id"]+"/approve",json={"version":1,"decision":"approve"},headers=auth(p))
    response = connected.post("/v1/admin/orders/"+o["id"]+"/release",
         json={"version":1,"inventory_reserved":True,"capacity_confirmed":True},headers=staff())
    assert response.json()["status"] == "in_production"
    assert connected.post("/v1/admin/proofs",json={"order_id":o["id"],"expected_proof_version":1,"proof_text":"too late"},headers=staff()).status_code == 409
    shipment = {"version":1,"carrier":"TEST CARRIER","tracking":"TEST-NOT-A-REAL-SHIPMENT"}
    first = connected.post("/v1/admin/orders/"+o["id"]+"/ship",json=shipment,headers=staff())
    second = connected.post("/v1/admin/orders/"+o["id"]+"/ship",json=shipment,headers=staff())
    assert first.json() == second.json()
    assert first.json()["status"] == "shipped"


def test_payment_return_is_never_payment_authority(connected):
    o = order(connected)
    assert connected.get("/v1/orders/"+o["id"],headers=auth(o)).json()["payment_status"] == "unpaid"
    assert connected.get("/ready").status_code == 503
    assert connected.get("/v1/capabilities").json()["production_ready"] is False


def test_access_secret_mismatch_fails_closed_without_rewriting_records(connected, monkeypatch):
    q = quote(connected)
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", "a-different-test-only-secret-"+"y"*40)
    assert connected.get("/v1/quotes/"+q["id"],headers=auth(q)).status_code == 503
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", "test-only-access-secret-"+"x"*40)
    assert connected.get("/v1/quotes/"+q["id"],headers=auth(q)).status_code == 200


def test_signed_malformed_event_is_rejected(connected):
    event = {"id":"evt_malformed","livemode":False,"type":"checkout.session.completed","data":"not an object"}
    assert send_event(connected,event).status_code == 400
