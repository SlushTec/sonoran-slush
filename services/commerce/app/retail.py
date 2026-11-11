"""Opt-in local/test retail slice. Synthetic offers never approve production prices."""
from collections import Counter
from collections.abc import Callable
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import AwareDatetime, Field, StrictInt, StrictBool, field_validator, model_validator, model_serializer
from pydantic.json_schema import SkipJsonSchema
from services.commerce.app.workflows import (
    Item, StrictModel, NOW, database, enabled, event, load, private, receipt, save, staff,
)

from services.commerce.app.piece_personalization import (
    Personalization, CRYSTAL_KEYS, piece_snapshot, validate_persisted_items, validate_stored_snapshot,
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
    pieces_per_item: Annotated[StrictInt, Field(ge=1, le=100)] | SkipJsonSchema[None] = Field(default=None, json_schema_extra=lambda schema: schema.pop("default", None))

    @model_validator(mode="before")
    @classmethod
    def explicit_piece_count(cls, value):
        if isinstance(value, dict) and "pieces_per_item" in value and value["pieces_per_item"] is None:
            raise ValueError("Omit an unqualified piece count; do not supply null.")
        return value


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
        if body.pieces_per_item is not None:
            doc["pieces_per_item"] = body.pieces_per_item
        elif old:
            previous = json.loads(old[0])
            if "pieces_per_item" in previous:
                count = previous["pieces_per_item"]
                if type(count) is not int or not 1 <= count <= 100:
                    raise HTTPException(409, "Stored test piece count needs reconciliation.")
                doc["pieces_per_item"] = count
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
    personalization: Personalization | SkipJsonSchema[None] = Field(default=None, json_schema_extra=lambda schema: schema.pop("default", None))

    @model_serializer(mode="wrap")
    def preserve_legacy_shape(self, handler):
        data = handler(self)
        if "personalization" not in self.model_fields_set:
            data.pop("personalization", None)
        return data

    @model_validator(mode="before")
    @classmethod
    def explicit_personalization(cls, value):
        if isinstance(value, dict) and "personalization" in value and value["personalization"] is None:
            raise ValueError("Omit legacy personalization; explicit null is not supported.")
        return value

    @model_validator(mode="after")
    def no_competing_inscriptions(self):
        if self.personalization is not None:
            if self.text or self.secondary or set(self.options) - CRYSTAL_KEYS:
                raise ValueError("Structured piece text cannot compete with legacy inscriptions or arbitrary options.")
        return self



class CartRequest(StrictModel):
    request_id: UUID
    items: list[RetailItem] = Field(min_length=1, max_length=100)


def priced(db, items):
    lines = []
    total = 0
    mapped_pieces = 0
    for line_index, item in enumerate(items):
        row = db.execute("SELECT document FROM retail_offers WHERE slug=?", (item["product_slug"],)).fetchone()
        if not row:
            raise HTTPException(409, "A selected listing has no synthetic test offer.")
        offer = json.loads(row[0])
        amount = item["quantity"] * offer["unit_price_minor"]
        total += amount
        if total > 99999999:
            raise HTTPException(422, "The cart exceeds the supported test total.")
        lines.append({"item": item, "offer_version": offer["version"], "unit_price_minor": offer["unit_price_minor"], "line_total_minor": amount, "stock_id": offer["stock_id"], "stock_units": item["quantity"]*offer["units_per_item"]})
        mapping = piece_snapshot(item, offer, line_index)
        if mapping is not None:
            mapped_pieces += len(mapping["pieces"])
            if mapped_pieces > 2000:
                raise HTTPException(422, "Explicit personalization supports at most 2000 pieces per cart.")
            lines[-1]["personalization_snapshot"] = mapping
    return lines, total


@router.post("/v1/cart", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def create_cart(body: CartRequest):
    payload = body.model_dump(mode="json")
    for raw, item in zip(payload["items"], body.items):
        if "personalization" not in item.model_fields_set:
            raw.pop("personalization", None)
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
        validate_persisted_items(cart.get("items"), RetailItem)
        validate_stored_snapshot(cart.get("lines"), cart["items"])
        try:
            lines, total = priced(db, cart["items"])
        except HTTPException as exc:
            if exc.status_code == 422:
                raise HTTPException(409, "Stored cart configuration or offer changed; review a new cart.") from None
            raise
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


def reservation_clock() -> Callable[[], datetime]:
    # Inject the clock, not a precomputed instant: read it after BEGIN IMMEDIATE.
    # A request cannot supply time, and no default hold duration is selected.
    return lambda: datetime.now(timezone.utc)


Clock = Annotated[Callable[[], datetime], Depends(reservation_clock)]


def current_test_order(doc, version):
    if doc.get("kind") != "order" or doc.get("retail_test") is not True or doc.get("test_mode") is not True or doc["version"] != version:
        raise HTTPException(409, "A current synthetic retail test order is required.")


def provider_linked(db, doc):
    # Synthetic orders never carry provider fields, even empty/unknown ones.
    if "checkout_session_id" in doc or "payment_provider" in doc:
        return True
    # Existing databases may have a provider binding even if document metadata
    # needs reconciliation. Such ambiguity must never free a stock hold.
    for table in ("square_sessions", "square_payments"):
        exists = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        if exists and db.execute(f"SELECT 1 FROM {table} WHERE order_id=?", (doc["id"],)).fetchone():
            return True
    return False


def eligible_unpaid_hold(db, doc):
    if (doc.get("retail_test") is not True or doc.get("test_mode") is not True
            or doc.get("payment_status") != "unpaid" or provider_linked(db, doc)
            or doc.get("status") != "awaiting_payment"
            or doc.get("reservation_status") != "active" or not has_reservation(db, doc)):
        raise HTTPException(409, "Only a complete, demonstrably unpaid synthetic hold without provider linkage is eligible; reconcile other holds manually.")


def deadline_reached(doc, now):
    value = doc.get("test_hold_expires_at")
    if value is None:
        return False
    try:
        deadline = datetime.fromisoformat(value)
        if deadline.tzinfo is None or deadline.utcoffset() is None:
            raise ValueError("Naive persisted deadline")
    except (TypeError, ValueError):
        raise HTTPException(409, "The persisted test deadline requires reconciliation.")
    return now >= deadline


def expire_reservation(db, doc, now):
    """Caller owns the transaction; release exact components and record one reason."""
    eligible_unpaid_hold(db, doc)
    if not deadline_reached(doc, now):
        raise HTTPException(409, "An explicit elapsed test hold deadline is required.")
    db.execute("UPDATE retail_reservations SET state='released' WHERE order_id=? AND state='active'", (doc["id"],))
    doc.update(status="reservation_expired", reservation_status="expired", inventory_reserved=False,
               reservation_expired_at=now.astimezone(timezone.utc).isoformat(),
               next_step="Synthetic hold expired. A later simulated payment requires manual recovery; production is not authorized.")
    doc.setdefault("timeline", []).append({"label": "Synthetic hold expired and exact reservation released", "at": doc["reservation_expired_at"]})
    save(db, doc)


class TestHoldDeadline(Version):
    test_hold_expires_at: AwareDatetime

    @field_validator("test_hold_expires_at", mode="before")
    @classmethod
    def explicit_datetime(cls, value):
        # Pydantic also accepts numeric epoch values; this test-only contract does
        # not. Require an ISO date/time string with an explicit timezone.
        if not isinstance(value, str) or "T" not in value:
            raise ValueError("Supply an explicit timezone-aware ISO test deadline.")
        return value

    @field_validator("test_hold_expires_at")
    @classmethod
    def representable_utc(cls, value):
        try:
            return value.astimezone(timezone.utc)
        except (OverflowError, ValueError):
            raise ValueError("The test deadline must be representable in UTC.")


@router.post("/v1/admin/retail-test/orders/{record_id}/hold-deadline", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def set_hold_deadline(record_id: str, body: TestHoldDeadline, clock: Clock):
    with database() as db:
        schema(db)
        doc = load(db, record_id)
        current_test_order(doc, body.version)
        deadline = body.test_hold_expires_at.isoformat()
        if doc.get("test_hold_expires_at") is not None:
            if doc["test_hold_expires_at"] != deadline:
                raise HTTPException(409, "A test hold deadline is immutable; it cannot be extended or replaced.")
            return doc
        eligible_unpaid_hold(db, doc)
        if body.test_hold_expires_at <= clock():
            raise HTTPException(409, "A new test hold deadline must be in the future.")
        doc["test_hold_expires_at"] = deadline
        event(doc, "Explicit synthetic hold deadline assigned")
        save(db, doc)
        return doc


@router.post("/v1/admin/retail-test/orders/{record_id}/expire", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def expire_test_hold(record_id: str, body: Version, clock: Clock):
    with database() as db:
        schema(db)
        doc = load(db, record_id)
        current_test_order(doc, body.version)
        if doc.get("reservation_status") == "expired" or doc.get("status") == "cancelled":
            return doc
        expire_reservation(db, doc, clock())
        return doc


@router.post("/v1/orders/{record_id}/cancel-test", dependencies=[Depends(retail_enabled)], tags=["local test retail"])
def cancel(record_id: str, body: Version, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        schema(db)
        doc = private(db, record_id, authorization, {"order"})
        if not doc.get("retail_test") or doc["version"] != body.version:
            raise HTTPException(409, "A current local retail test order is required.")
        if doc["status"] == "cancelled" or doc.get("reservation_status") == "expired":
            return doc
        if doc["payment_status"] != "unpaid" or provider_linked(db, doc) or doc["reservation_status"] != "active":
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
def reconcile_test_payment(record_id: str, body: TestPayment, clock: Clock):
    with database() as db:
        schema(db)
        doc = load(db, record_id)
        digest = fingerprint({"order_id": record_id, **body.model_dump(mode="json")})
        key = "local-test:"+str(body.event_id)
        old = db.execute("SELECT fingerprint FROM payment_events WHERE id=?", (key,)).fetchone()
        if old:
            if old[0] != digest:
                raise HTTPException(409, "Payment event identity reused with different contents.")
            return {"received": True, "applied": False, "test_mode": True, "recovery_required": doc.get("payment_status") == "reconciliation_required"}
        if not doc.get("retail_test") or doc["version"] != body.version or doc["total_minor"] != body.amount_minor or doc["status"] == "cancelled":
            raise HTTPException(409, "Payment simulation does not match a current local retail test order.")
        if provider_linked(db, doc) or doc["payment_status"] not in {"unpaid", "paid", "reconciliation_required"}:
            raise HTTPException(409, "Ambiguous or provider-linked payment requires manual reconciliation, not local simulation.")
        applied = False
        if body.outcome == "paid" and doc["payment_status"] == "unpaid":
            now = clock()
            if doc.get("reservation_status") != "expired" and deadline_reached(doc, now):
                # The payment path enforces the deadline even if no expiry sweep
                # has run. The release and recovery record share this transaction.
                expire_reservation(db, doc, now)
            if doc.get("reservation_status") == "expired":
                doc.update(payment_status="reconciliation_required", status="payment_reconciliation_required",
                           payment_recovery_reason="reservation_expired",
                           next_step="Late synthetic payment recorded for manual recovery. No stock is reacquired and production is not authorized.")
                event(doc, "Late local test payment held for recovery (no processor or charge)")
            else:
                if not has_reservation(db, doc):
                    raise HTTPException(409, "Payment simulation requires a persisted reservation.")
                applied = True
                doc.update(payment_status="paid", status="awaiting_production_checks" if doc["proof_status"] == "approved" else "awaiting_approval", next_step="Local payment simulated; exact proof and capacity checks remain required.")
                event(doc, "Local test payment simulated (no processor or charge)")
            save(db, doc)
        db.execute("INSERT INTO payment_events VALUES(?,?,?)", (key, digest, record_id))
        return {"received": True, "applied": applied, "test_mode": True, "recovery_required": doc["payment_status"] == "reconciliation_required"}


class Capacity(Version):
    confirmed: StrictBool


@router.post("/v1/admin/retail-test/orders/{record_id}/capacity", dependencies=[Depends(retail_enabled), Depends(staff)], tags=["local test retail"])
def capacity(record_id: str, body: Capacity):
    with database() as db:
        doc = load(db, record_id)
        if not doc.get("retail_test") or doc["version"] != body.version or doc["status"] in {"in_production", "shipped", "cancelled"} or doc.get("reservation_status") == "expired":
            raise HTTPException(409, "An unreleased current test order is required.")
        if doc["capacity_confirmed"] == body.confirmed:
            return doc
        doc["capacity_confirmed"] = body.confirmed
        event(doc, "Local test capacity confirmed" if body.confirmed else "Local test capacity withdrawn")
        save(db, doc)
        return doc
