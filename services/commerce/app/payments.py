"""Test-mode-only hosted payment adapter; no live charging is enabled."""
from hashlib import sha256
from typing import Annotated
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import Field, StrictInt
from services.commerce.app.workflows import StrictModel, database, enabled, event, load, private, save

router = APIRouter()


def configured():
    enabled()
    if os.environ.get("SONORAN_TEST_PAYMENTS_ENABLED") != "true" or not os.environ.get("STRIPE_SECRET_KEY", "").startswith("sk_test_"):
        raise HTTPException(503, "Test payment services are not connected.")


class SessionRequest(StrictModel):
    order_id: str = Field(max_length=100)
    version: StrictInt = Field(ge=1)


def stripe_checkout(fields: dict, idempotency_key: str) -> dict:
    request = urllib.request.Request(
        "https://api.stripe.com/v1/checkout/sessions",
        data=urllib.parse.urlencode(fields).encode(),
        headers={"Authorization":"Bearer "+os.environ["STRIPE_SECRET_KEY"],
                 "Content-Type":"application/x-www-form-urlencoded", "Idempotency-Key":idempotency_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.loads(response.read(65536))
        if not isinstance(data.get("id"), str) or not isinstance(data.get("url"), str) or not data["url"].startswith("https://checkout.stripe.com/"):
            raise ValueError("Unexpected processor response")
        return data
    except (urllib.error.URLError, ValueError, OSError):
        raise HTTPException(502, "The payment provider did not confirm a session. Please retry this same order.")


@router.post("/v1/checkout/sessions", dependencies=[Depends(configured)], tags=["test payments"])
def checkout(body: SessionRequest, authorization: Annotated[str | None, Header()] = None):
    origin = os.environ.get("SONORAN_STOREFRONT_ORIGIN", "")
    if not origin.startswith("https://") or "?" in origin or "#" in origin:
        raise HTTPException(503, "The payment return address is not configured.")
    # Serialize order/payment changes so a concurrent commercial revision cannot
    # produce a session at a stale total. The provider idempotency key also survives
    # a network interruption between the provider response and local commit.
    with database() as db:
        order = private(db, body.order_id, authorization, {"order"})
        if body.version != order["version"] or order["payment_status"] != "unpaid":
            raise HTTPException(409, "The current unpaid order version is required.")
        amount = order.get("total_minor")
        if type(amount) is not int or amount <= 0:
            raise HTTPException(409, "This order does not have a reviewed total.")
        result = stripe_checkout({
          "mode":"payment", "client_reference_id":order["id"], "metadata[order_id]":order["id"],
          "metadata[order_version]":str(order["version"]),
          "line_items[0][quantity]":"1", "line_items[0][price_data][currency]":"usd",
          "line_items[0][price_data][unit_amount]":str(amount),
          "line_items[0][price_data][product_data][name]":"Reviewed custom order "+order["id"],
          "success_url":origin.rstrip("/")+"/orders?payment=returned",
          "cancel_url":origin.rstrip("/")+"/orders?payment=cancelled",
        }, "sonoran:"+order["id"]+":"+str(order["version"]))
        if order.get("checkout_session_id") not in {None, result["id"]}:
            raise HTTPException(409, "An existing payment session must be reconciled first.")
        order["checkout_session_id"] = result["id"]
        save(db, order)
        return {"url":result["url"], "session_id":result["id"], "test_mode":True}


def verify_signature(raw: bytes, signature: str, secret: str, now: int | None = None) -> dict:
    try:
        entries = [v.split("=", 1) for v in signature.split(",")]
        stamp = next(v for k, v in entries if k == "t")
        signed_at = int(stamp)
        if abs((int(time.time()) if now is None else now)-signed_at) > 300:
            raise ValueError("Stale signature")
        expected = hmac.new(secret.encode(), stamp.encode()+b"."+raw, sha256).hexdigest()
        if not any(k=="v1" and hmac.compare_digest(expected, v) for k, v in entries):
            raise ValueError("Invalid signature")
        value = json.loads(raw)
        if not isinstance(value, dict) or not isinstance(value.get("id"), str):
            raise ValueError("Invalid event")
        return value
    except (ValueError, TypeError, StopIteration):
        raise HTTPException(400, "The payment event could not be verified.")


@router.post("/v1/webhooks/payments", dependencies=[Depends(configured)], tags=["test payments"])
async def payment_webhook(request: Request, stripe_signature: Annotated[str | None, Header()] = None):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    if not secret.startswith("whsec_"):
        raise HTTPException(503, "The payment verification service is not connected.")
    raw = await request.body()
    if len(raw) > 65536:
        raise HTTPException(413, "The event exceeds the supported size.")
    payload = verify_signature(raw, stripe_signature or "", secret)
    if payload.get("livemode") is not False:
        raise HTTPException(400, "Only test events are accepted by this adapter.")
    if payload.get("type") not in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        return {"received":True, "applied":False}
    data = payload.get("data")
    session = data.get("object") if isinstance(data, dict) else None
    if not isinstance(session, dict) or not isinstance(session.get("metadata"), dict):
        raise HTTPException(400, "The event is missing a payment session.")
    if session.get("payment_status") != "paid":
        return {"received":True, "applied":False}
    oid = session.get("metadata", {}).get("order_id")
    if not isinstance(oid, str) or session.get("client_reference_id") != oid:
        raise HTTPException(400, "The payment identity does not match.")
    fingerprint = sha256(raw).hexdigest()
    with database() as db:
        order = load(db, oid)
        if order["kind"] != "order" or order.get("checkout_session_id") != session.get("id") or type(session.get("amount_total")) is not int or order.get("total_minor") != session["amount_total"] or session.get("currency") != "usd" or session.get("metadata", {}).get("order_version") != str(order["version"]):
            raise HTTPException(409, "The verified payment does not match the current order.")
        old = db.execute("SELECT fingerprint FROM payment_events WHERE id=?", (payload["id"],)).fetchone()
        if old:
            if old[0] != fingerprint:
                raise HTTPException(409, "The event identity was reused with different contents.")
            return {"received":True, "applied":False}
        if order["payment_status"] not in {"unpaid", "paid"}:
            raise HTTPException(409, "The payment needs reconciliation.")
        if order["payment_status"] == "unpaid":
            order["payment_status"] = "paid"
            order["status"] = "awaiting_production_checks" if order.get("proof_status") == "approved" else "awaiting_approval"
            order["next_step"] = "Payment verified. Current artwork approval, inventory, and capacity are still required."
            event(order, "Payment verified by signed processor event")
            save(db, order)
        db.execute("INSERT INTO payment_events VALUES(?,?,?)", (payload["id"], fingerprint, oid))
        return {"received":True, "applied":True}
