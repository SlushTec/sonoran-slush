"""Square sandbox only. No credentials are created or accessed by tests."""
from hashlib import sha256
from typing import Annotated
import base64
import hmac
import json
import os
import re
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import Field, StrictInt
from services.commerce.app.workflows import StrictModel, database, enabled, event, load, private, save

router = APIRouter()


def configured():
    enabled()
    names = ("SQUARE_SANDBOX_ACCESS_TOKEN", "SQUARE_SANDBOX_LOCATION_ID", "SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_SANDBOX_WEBHOOK_KEY", "SQUARE_WEBHOOK_NOTIFICATION_URL")
    if os.environ.get("SONORAN_TEST_PAYMENTS_ENABLED") != "true" or os.environ.get("SQUARE_ENVIRONMENT") != "sandbox" or not all(os.environ.get(n) for n in names):
        raise HTTPException(503, "Square sandbox payment services are not connected.")


class SessionRequest(StrictModel):
    order_id: str = Field(max_length=100)
    version: StrictInt = Field(ge=1)


class RefuseRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        # Never resend an Authorization header to a redirect target, even same-host.
        raise urllib.error.HTTPError(request.full_url, code, "Square API redirects are refused", headers, fp)


def sandbox_checkout_url(value):
    # Buyer URLs differ from the API host. Accept only documented sandbox links,
    # default HTTPS port and a single opaque /u/ token; no query/fragment/userinfo.
    return isinstance(value, str) and re.fullmatch(
        r"https://sandbox\.square\.link(?::443)?/u/[A-Za-z0-9_-]+", value
    ) is not None


def square_checkout(fields: dict) -> dict:
    request = urllib.request.Request(
        "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
        data=json.dumps(fields).encode(),
        headers={"Authorization": "Bearer "+os.environ["SQUARE_SANDBOX_ACCESS_TOKEN"], "Content-Type": "application/json", "Square-Version": "2026-09-16"}, method="POST")
    try:
        with urllib.request.build_opener(RefuseRedirects()).open(request, timeout=12) as response:
            link = json.loads(response.read(65536)).get("payment_link", {})
        if not all(isinstance(link.get(k), str) and link[k] for k in ("id", "order_id", "url")) or not sandbox_checkout_url(link.get("url")):
            raise ValueError("Unexpected sandbox response")
        return link
    except (urllib.error.URLError, ValueError, TypeError, AttributeError, OSError):
        raise HTTPException(502, "Square did not confirm a sandbox session. Retry the same order.")


@router.post("/v1/checkout/sessions", dependencies=[Depends(configured)], tags=["test payments"])
def checkout(body: SessionRequest, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        order = private(db, body.order_id, authorization, {"order"})
        if order.get("retail_test"):
            raise HTTPException(409, "Synthetic retail orders use local simulation only, never processor checkout.")
        if body.version != order["version"] or order["payment_status"] != "unpaid" or order["status"] == "cancelled":
            raise HTTPException(409, "The current unpaid order version is required.")
        amount = order.get("total_minor")
        if type(amount) is not int or amount <= 0:
            raise HTTPException(409, "This order does not have a reviewed total.")
        schema(db)
        existing = db.execute("SELECT link_id, url FROM square_sessions WHERE order_id=? AND version=?", (order["id"], order["version"])).fetchone()
        if existing:
            if not sandbox_checkout_url(existing[1]):
                raise HTTPException(409, "Stored checkout URL needs reconciliation.")
            return {"url": existing[1], "session_id": existing[0], "test_mode": True, "provider": "square"}
        if order.get("checkout_session_id"):
            raise HTTPException(409, "An earlier provider session needs reconciliation before switching providers.")
        link = square_checkout({"idempotency_key": "sonoran:"+order["id"]+":"+str(order["version"]), "order": {
            "location_id": os.environ["SQUARE_SANDBOX_LOCATION_ID"], "reference_id": order["id"],
            "metadata": {"order_version": str(order["version"])},
            "line_items": [{"name": "Reviewed test order "+order["id"], "quantity": "1", "base_price_money": {"amount": amount, "currency": "USD"}}]},
            "checkout_options": {"allow_tipping": False}})
        db.execute("INSERT INTO square_sessions VALUES(?,?,?,?,?)", (link["order_id"], order["id"], order["version"], link["id"], link["url"]))
        order.update(checkout_session_id=link["id"], payment_provider="square_sandbox")
        save(db, order)
        return {"url": link["url"], "session_id": link["id"], "test_mode": True, "provider": "square"}


def schema(db):
    db.execute("CREATE TABLE IF NOT EXISTS square_sessions (provider_order_id TEXT PRIMARY KEY, order_id TEXT NOT NULL, version INTEGER NOT NULL, link_id TEXT NOT NULL, url TEXT NOT NULL, UNIQUE(order_id,version))")
    db.execute("CREATE TABLE IF NOT EXISTS square_payments (payment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE)")


def verify_signature(raw: bytes, signature: str, secret: str, notification_url: str) -> dict:
    expected = base64.b64encode(hmac.new(secret.encode(), notification_url.encode()+raw, sha256).digest()).decode()
    if not signature.isascii() or not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "The Square event signature could not be verified.")
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict) or not isinstance(payload.get("event_id"), str) or not payload["event_id"]:
            raise ValueError("Missing event identity")
        return payload
    except (ValueError, TypeError, RecursionError):
        raise HTTPException(400, "The payment event could not be verified.")


@router.post("/v1/webhooks/payments", dependencies=[Depends(configured)], tags=["test payments"])
async def payment_webhook(request: Request, x_square_hmacsha256_signature: Annotated[str | None, Header()] = None):
    # Bound accumulated bytes before authentication, including chunked requests.
    # The ASGI server still owns allocation of each incoming chunk.
    buffer = bytearray()
    async for chunk in request.stream():
        if len(chunk) > 65536 - len(buffer):
            raise HTTPException(413, "The event exceeds the supported size.")
        buffer.extend(chunk)
    raw = bytes(buffer)
    payload = verify_signature(raw, x_square_hmacsha256_signature or "", os.environ["SQUARE_SANDBOX_WEBHOOK_KEY"], os.environ["SQUARE_WEBHOOK_NOTIFICATION_URL"])
    if payload.get("merchant_id") != os.environ["SQUARE_SANDBOX_MERCHANT_ID"]:
        raise HTTPException(400, "The event merchant does not match the configured sandbox merchant.")
    if payload.get("type") not in {"payment.created", "payment.updated"}:
        return {"received": True, "applied": False}
    data = payload.get("data")
    obj = data.get("object") if isinstance(data, dict) else None
    payment = obj.get("payment") if isinstance(obj, dict) else None
    if not isinstance(payment, dict) or not isinstance(payment.get("id"), str) or not payment["id"] or data.get("id") != payment["id"]:
        raise HTTPException(400, "The event is missing a consistent payment identity.")
    if payment.get("status") != "COMPLETED":
        return {"received": True, "applied": False}
    if not isinstance(payment.get("order_id"), str) or not payment["order_id"]:
        raise HTTPException(400, "The payment is missing its Square order identity.")
    money = payment.get("amount_money")
    if not isinstance(money, dict) or type(money.get("amount")) is not int:
        raise HTTPException(400, "The event is missing an integer amount.")
    refund = payment.get("refunded_money")
    if refund is not None and (
        not isinstance(refund, dict) or type(refund.get("amount")) is not int
        or refund["amount"] < 0 or refund.get("currency") != "USD"
    ):
        raise HTTPException(400, "The refunded amount is invalid; reconciliation required.")
    refunded = refund is not None and refund["amount"] > 0
    digest = sha256(raw).hexdigest()
    with database() as db:
        schema(db)
        binding = db.execute("SELECT order_id,version,link_id FROM square_sessions WHERE provider_order_id=?", (payment.get("order_id"),)).fetchone()
        if not binding:
            raise HTTPException(409, "Unknown Square order; reconciliation required.")
        order = load(db, binding[0])
        if order["kind"] != "order" or order["version"] != binding[1] or order.get("checkout_session_id") != binding[2] or order.get("payment_provider") != "square_sandbox" or order["total_minor"] != money["amount"] or money.get("currency") != "USD" or payment.get("location_id") != os.environ["SQUARE_SANDBOX_LOCATION_ID"] or order["status"] == "cancelled":
            raise HTTPException(409, "The payment does not match the current sandbox order.")
        key = "square:"+payload["event_id"]
        old = db.execute("SELECT fingerprint FROM payment_events WHERE id=?", (key,)).fetchone()
        if old:
            if old[0] != digest:
                raise HTTPException(409, "The event identity was reused with different contents.")
            return {"received": True, "applied": False}
        prior = db.execute("SELECT payment_id FROM square_payments WHERE order_id=?", (order["id"],)).fetchone()
        reused = db.execute("SELECT order_id FROM square_payments WHERE payment_id=?", (payment["id"],)).fetchone()
        if (prior and prior[0] != payment["id"]) or (reused and reused[0] != order["id"]) or order["payment_status"] not in ({"unpaid", "paid", "reconciliation_required"} if refunded else {"unpaid", "paid"}):
            raise HTTPException(409, "Payment identity needs reconciliation.")
        if not prior:
            db.execute("INSERT INTO square_payments VALUES(?,?)", (payment["id"], order["id"]))
        if refunded:
            order.update(payment_status="reconciliation_required", status="payment_reconciliation_required",
                         refunded_minor=max(order.get("refunded_minor", 0), refund["amount"]), next_step="Square reports a refund. Staff reconciliation is required; payment cannot authorize production.")
            event(order, "Square sandbox refund requires reconciliation")
            save(db, order)
            db.execute("INSERT INTO payment_events VALUES(?,?,?)", (key, digest, order["id"]))
            return {"received": True, "applied": True, "reconciliation_required": True}
        applied = order["payment_status"] == "unpaid"
        if applied:
            order.update(payment_status="paid", status="awaiting_production_checks" if order.get("proof_status") == "approved" else "awaiting_approval", next_step="Square sandbox payment verified. Independent proof, inventory and capacity checks remain required.")
            event(order, "Payment verified by signed Square sandbox event")
            save(db, order)
        db.execute("INSERT INTO payment_events VALUES(?,?,?)", (key, digest, order["id"]))
        return {"received": True, "applied": applied}
