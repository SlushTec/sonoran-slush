"""Opt-in local/test retail slice. Synthetic offers never approve production prices."""
from collections import Counter
from hashlib import sha256
import json
import os
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import Field, StrictInt, StrictBool
from services.commerce.app.workflows import (
    Item, StrictModel, NOW, database, enabled, event, load, private, receipt, save, staff,
)

router = APIRouter()
Key = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")]
Money = Annotated[StrictInt, Field(ge=1, le=99999999)]


def retail_enabled():
    enabled()
    if os.environ.get("SONORAN_RETAIL_TEST_ENABLED") != "true":
        raise HTTPException(503, "Local test retail is not enabled; production catalog remains unapproved.")


def schema(db):
    # execute, not executescript: preserve the caller's BEGIN IMMEDIATE transaction.
    for sql in (
        "CREATE TABLE IF NOT EXISTS retail_stock (id TEXT PRIMARY KEY, on_hand INTEGER NOT NULL CHECK(on_hand>=0), version INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS retail_offers (slug TEXT PRIMARY KEY, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS retail_reservations (order_id TEXT NOT NULL, stock_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0), state TEXT NOT NULL CHECK(state IN ('active','consumed','released')), PRIMARY KEY(order_id,stock_id))",
    ):
        db.execute(sql)


def fingerprint(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def reserved(db, stock_id):
    return db.execute("SELECT COALESCE(SUM(units),0) FROM retail_reservations WHERE stock_id=? AND state='active'", (stock_id,)).fetchone()[0]


class Stock(StrictModel):
    expected_version: StrictInt = Field(ge=0)
    on_hand: StrictInt = Field(ge=0, le=1000000)


@router.post("/v1/admin/retail-test/stock/{stock_id}", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def set_stock(stock_id: Key, body: Stock):
    with database() as db:
        schema(db)
        old = db.execute("SELECT version FROM retail_stock WHERE id=?", (stock_id,)).fetchone()
        if body.expected_version != (old[0] if old else 0) or body.on_hand < reserved(db, stock_id):
            raise HTTPException(409, "Stock version changed or requested count is below active reservations.")
        version = body.expected_version + 1
        db.execute("INSERT INTO retail_stock VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET on_hand=excluded.on_hand, version=excluded.version", (stock_id, body.on_hand, version))
        return {"stock_id": stock_id, "on_hand": body.on_hand, "reserved": reserved(db, stock_id), "version": version, "test_mode": True}


class Offer(StrictModel):
    expected_version: StrictInt = Field(ge=0)
    unit_price_minor: Money
    stock_id: Key
    units_per_item: StrictInt = Field(ge=1, le=100)


@router.post("/v1/admin/retail-test/offers/{slug}", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def set_offer(slug: Key, body: Offer):
    from services.commerce.app.workflows import PRODUCTS
    if slug not in PRODUCTS:
        raise HTTPException(422, "Select an existing listing for the synthetic test offer.")
    with database() as db:
        schema(db)
        old = db.execute("SELECT document FROM retail_offers WHERE slug=?", (slug,)).fetchone()
        if body.expected_version != (json.loads(old[0])["version"] if old else 0):
            raise HTTPException(409, "Offer version changed.")
        if not db.execute("SELECT 1 FROM retail_stock WHERE id=?", (body.stock_id,)).fetchone():
            raise HTTPException(409, "Create the synthetic blank stock first.")
        doc = {"product_slug": slug, "version": body.expected_version+1, "unit_price_minor": body.unit_price_minor, "currency": "USD", "stock_id": body.stock_id, "units_per_item": body.units_per_item, "test_mode": True}
        db.execute("INSERT INTO retail_offers VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET document=excluded.document", (slug, json.dumps(doc)))
        return doc


@router.get("/v1/retail-test/catalog", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def catalog():
    with database() as db:
        schema(db)
        offers = [json.loads(r[0]) for r in db.execute("SELECT document FROM retail_offers ORDER BY slug")]
        return {"test_mode": True, "production_approved": False, "offers": offers}


class RetailItem(Item):
    # Also validate omitted options: a crystal cannot bypass its keep-list requirements.
    options: dict[Annotated[str, Field(max_length=60)], Annotated[str, Field(max_length=200)]] = Field(default_factory=dict, max_length=16, validate_default=True)


class CartRequest(StrictModel):
    request_id: UUID
    items: list[RetailItem] = Field(min_length=1, max_length=100)


def priced(db, items):
    lines = []
    total = 0
    for item in items:
        row = db.execute("SELECT document FROM retail_offers WHERE slug=?", (item["product_slug"],)).fetchone()
        if not row:
            raise HTTPException(409, "A selected listing has no synthetic test offer.")
        offer = json.loads(row[0])
        amount = item["quantity"] * offer["unit_price_minor"]
        total += amount
        if total > 99999999:
            raise HTTPException(422, "The cart exceeds the supported test total.")
        lines.append({"item": item, "offer_version": offer["version"], "unit_price_minor": offer["unit_price_minor"], "line_total_minor": amount, "stock_id": offer["stock_id"], "stock_units": item["quantity"]*offer["units_per_item"]})
    return lines, total


@router.post("/v1/cart", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def create_cart(body: CartRequest):
    payload = body.model_dump(mode="json")
    key = "retail-cart:"+str(body.request_id)
    digest = fingerprint(payload)
    with database() as db:
        schema(db)
        old = db.execute("SELECT fingerprint,record_id FROM requests WHERE id=?", (key,)).fetchone()
        if old:
            if old[0] != digest:
                raise HTTPException(409, "The cart request identity was reused with different contents.")
            return receipt(load(db, old[1]))
        lines, total = priced(db, payload["items"])
        doc = {"id": "cart_"+uuid4().hex, "kind": "cart", "version": 1, "status": "priced", "created_at": NOW(), "items": payload["items"], "lines": lines, "total_minor": total, "currency": "USD", "test_mode": True, "pricing_scope": "synthetic merchandise only; no tax/shipping calculation or selling-price approval"}
        save(db, doc)
        db.execute("INSERT INTO requests VALUES(?,?,?)", (key, digest, doc["id"]))
        return receipt(doc)


@router.get("/v1/cart/{record_id}", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def get_cart(record_id: str, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        return private(db, record_id, authorization, {"cart"})


class Version(StrictModel):
    version: StrictInt = Field(ge=1)


@router.post("/v1/cart/{record_id}/orders", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def order_from_cart(record_id: str, body: Version, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        schema(db)
        cart = private(db, record_id, authorization, {"cart"})
        if cart["version"] != body.version:
            raise HTTPException(409, "The current cart version is required.")
        if cart.get("order_id"):
            return receipt(load(db, cart["order_id"]))
        lines, total = priced(db, cart["items"])
        if lines != cart["lines"] or total != cart["total_minor"]:
            raise HTTPException(409, "Offers changed; create and review a new cart with a new request identity.")
        needs = Counter()
        for line in lines:
            needs[line["stock_id"]] += line["stock_units"]
        for stock_id, units in needs.items():
            stock = db.execute("SELECT on_hand FROM retail_stock WHERE id=?", (stock_id,)).fetchone()
            if stock is None or stock[0]-reserved(db, stock_id) < units:
                raise HTTPException(409, "Insufficient shared blank stock; no items were reserved.")
        doc = {"id": "ord_"+uuid4().hex, "kind": "order", "version": 1, "status": "awaiting_payment", "created_at": NOW(), "cart_id": cart["id"], "total_minor": total, "currency": "USD", "items": cart["items"], "lines": lines, "test_mode": True, "retail_test": True, "pricing_scope": cart["pricing_scope"], "payment_status": "unpaid", "proof_status": "awaiting_proof", "proof_required": True, "current_proof_id": None, "approved_proof_version": None, "inventory_reserved": True, "capacity_confirmed": False, "reservation_status": "active", "next_step": "Local test only: simulate payment and approve the current proof before test production release."}
        for stock_id, units in needs.items():
            db.execute("INSERT INTO retail_reservations VALUES(?,?,?,'active')", (doc["id"], stock_id, units))
        event(doc, "Synthetic retail order created with shared stock reservation")
        save(db, doc)
        cart.update(order_id=doc["id"], status="ordered")
        save(db, cart)
        return receipt(doc)


def has_reservation(db, doc):
    schema(db)
    expected = Counter()
    for line in doc["lines"]:
        expected[line["stock_id"]] += line["stock_units"]
    actual = {r[0]: r[1] for r in db.execute("SELECT stock_id,units FROM retail_reservations WHERE order_id=? AND state='active'", (doc["id"],))}
    return bool(expected) and dict(expected) == actual


def consume_reservation(db, doc):
    if not has_reservation(db, doc):
        raise HTTPException(409, "A complete persisted reservation is required.")
    for stock_id, units in db.execute("SELECT stock_id,units FROM retail_reservations WHERE order_id=?", (doc["id"],)).fetchall():
        result = db.execute("UPDATE retail_stock SET on_hand=on_hand-?, version=version+1 WHERE id=? AND on_hand>=?", (units, stock_id, units))
        if result.rowcount != 1:
            raise HTTPException(409, "Reserved inventory needs reconciliation.")
    db.execute("UPDATE retail_reservations SET state='consumed' WHERE order_id=?", (doc["id"],))
    doc["reservation_status"] = "consumed"


@router.post("/v1/orders/{record_id}/cancel-test", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def cancel(record_id: str, body: Version, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        schema(db)
        doc = private(db, record_id, authorization, {"order"})
        if not doc.get("retail_test") or doc["version"] != body.version:
            raise HTTPException(409, "A current local retail test order is required.")
        if doc["status"] == "cancelled":
            return doc
        if doc["payment_status"] != "unpaid" or doc.get("checkout_session_id") or doc["reservation_status"] != "active":
            raise HTTPException(409, "Only unpaid, unsubmitted test orders can be cancelled.")
        db.execute("UPDATE retail_reservations SET state='released' WHERE order_id=? AND state='active'", (doc["id"],))
        doc.update(status="cancelled", reservation_status="released", inventory_reserved=False, next_step="Test order cancelled; stock released. Create a new cart to start again.")
        event(doc, "Test order cancelled and reservation released")
        save(db, doc)
        return doc


class TestPayment(StrictModel):
    event_id: UUID
    version: StrictInt = Field(ge=1)
    amount_minor: Money
    currency: Literal["USD"]
    outcome: Literal["paid", "failed"]


@router.post("/v1/admin/retail-test/orders/{record_id}/payments", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def reconcile_test_payment(record_id: str, body: TestPayment):
    with database() as db:
        schema(db)
        doc = load(db, record_id)
        digest = fingerprint({"order_id": record_id, **body.model_dump(mode="json")})
        key = "local-test:"+str(body.event_id)
        old = db.execute("SELECT fingerprint FROM payment_events WHERE id=?", (key,)).fetchone()
        if old:
            if old[0] != digest:
                raise HTTPException(409, "Payment event identity reused with different contents.")
            return {"received": True, "applied": False, "test_mode": True}
        if not doc.get("retail_test") or doc["version"] != body.version or doc["total_minor"] != body.amount_minor or doc["status"] == "cancelled":
            raise HTTPException(409, "Payment simulation does not match a current local retail test order.")
        applied = body.outcome == "paid" and doc["payment_status"] == "unpaid"
        if applied:
            if not has_reservation(db, doc):
                raise HTTPException(409, "Payment simulation requires a persisted reservation.")
            doc.update(payment_status="paid", status="awaiting_production_checks" if doc["proof_status"] == "approved" else "awaiting_approval", next_step="Local payment simulated; exact proof and capacity checks remain required.")
            event(doc, "Local test payment simulated (no processor or charge)")
            save(db, doc)
        db.execute("INSERT INTO payment_events VALUES(?,?,?)", (key, digest, record_id))
        return {"received": True, "applied": applied, "test_mode": True}


class Capacity(Version):
    confirmed: StrictBool


@router.post("/v1/admin/retail-test/orders/{record_id}/capacity", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def capacity(record_id: str, body: Capacity):
    with database() as db:
        doc = load(db, record_id)
        if not doc.get("retail_test") or doc["version"] != body.version or doc["status"] in {"in_production", "shipped", "cancelled"}:
            raise HTTPException(409, "An unreleased current test order is required.")
        if doc["capacity_confirmed"] == body.confirmed:
            return doc
        doc["capacity_confirmed"] = body.confirmed
        event(doc, "Local test capacity confirmed" if body.confirmed else "Local test capacity withdrawn")
        save(db, doc)
        return doc
