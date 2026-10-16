"""Durable local request/quote/proof workflow.

Explicitly opt-in, nonproduction only. No fabricated stock, prices, or payments.
The AWS production data adapter and operating qualification remain release gates.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import date as CalendarDate, datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID, uuid4
import base64
import hmac
import json
import os
import re
import secrets
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from services.commerce.app.domain.prerequisites import ProductionPrerequisites

router = APIRouter()
ROOT = Path(__file__).resolve().parents[3]
PRODUCTS = {p["slug"]: p for p in json.loads((ROOT / "packages/contracts/catalog.reference.json").read_text())["products"]}
NOW = lambda: datetime.now(timezone.utc).isoformat()


def enabled():
    if os.environ.get("SONORAN_REQUESTS_ENABLED") != "true":
        raise HTTPException(503, "Request services are not connected.")
    if os.environ.get("SONORAN_STAGE", "scaffold") not in {"scaffold", "local"}:
        raise HTTPException(503, "The local workflow is not qualified for production.")
    if len(os.environ.get("SONORAN_ACCESS_SECRET", "")) < 32:
        raise HTTPException(503, "Request service configuration is incomplete.")


def bearer(authorization: str | None) -> str:
    return authorization[7:] if authorization and authorization.startswith("Bearer ") else ""


def staff(authorization: Annotated[str | None, Header()] = None):
    enabled()
    expected = os.environ.get("SONORAN_STAFF_TOKEN", "")
    if len(expected) < 32 or not secrets.compare_digest(bearer(authorization), expected):
        raise HTTPException(401, "Staff access could not be verified.")


def access_token(record_id: str) -> str:
    digest = hmac.new(os.environ["SONORAN_ACCESS_SECRET"].encode(), ("sonoran:" + record_id).encode(), sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


@contextmanager
def database():
    enabled()
    path = Path(os.environ.get("SONORAN_DB_PATH") or str(ROOT / ".state" / "commerce.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    connection = sqlite3.connect(path, timeout=15, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY, kind TEXT NOT NULL, token_hash TEXT NOT NULL, document TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, record_id TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payment_events (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, order_id TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    """)
    try:
        connection.execute("BEGIN IMMEDIATE")
        fingerprint = sha256(os.environ["SONORAN_ACCESS_SECRET"].encode()).hexdigest()
        old = connection.execute("SELECT value FROM metadata WHERE key='access_secret_fingerprint'").fetchone()
        if old and not secrets.compare_digest(old[0], fingerprint):
            raise HTTPException(503, "The record service needs its existing access configuration restored.")
        if not old:
            connection.execute("INSERT INTO metadata VALUES('access_secret_fingerprint',?)", (fingerprint,))
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    try:
        path.chmod(0o600)
    except OSError:
        pass


def load(db, record_id: str) -> dict:
    row = db.execute("SELECT document FROM records WHERE id = ?", (record_id,)).fetchone()
    if not row:
        raise HTTPException(404, "The private record could not be opened.")
    return json.loads(row[0])


def private(db, record_id: str, authorization: str | None, kinds: set[str]) -> dict:
    row = db.execute("SELECT token_hash, document FROM records WHERE id = ?", (record_id,)).fetchone()
    supplied = sha256(bearer(authorization).encode()).hexdigest()
    if not row or not secrets.compare_digest(row[0], supplied):
        raise HTTPException(404, "The private record could not be opened.")
    doc = json.loads(row[1])
    if doc["kind"] not in kinds:
        raise HTTPException(404, "The private record could not be opened.")
    return doc


def save(db, doc: dict):
    doc["updated_at"] = NOW()
    db.execute(
        "INSERT INTO records(id, kind, token_hash, document) VALUES(?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET document=excluded.document",
        (doc["id"], doc["kind"], sha256(access_token(doc["id"]).encode()).hexdigest(), json.dumps(doc, sort_keys=True)),
    )


def event(doc: dict, label: str):
    doc.setdefault("timeline", []).append({"label": label, "at": NOW()})


def receipt(doc: dict) -> dict:
    return {"id": doc["id"], "status": doc["status"], "access_token": access_token(doc["id"])}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


Short = Annotated[str, Field(max_length=200)]


class Item(StrictModel):
    product_slug: str = Field(max_length=100)
    quantity: StrictInt = Field(ge=1, le=500)
    text: str = Field(default="", max_length=120)
    secondary: str = Field(default="", max_length=120)
    font: Literal["Classic serif", "Modern sans", "Handwritten"] = "Classic serif"
    options: dict[Annotated[str, Field(max_length=60)], Short] = Field(default_factory=dict, max_length=16)
    notes: str = Field(default="", max_length=1500)
    artwork_name: str = Field(default="", max_length=255)
    gift: StrictBool = False
    gift_message: str = Field(default="", max_length=300)

    @field_validator("product_slug")
    @classmethod
    def known_product(cls, value):
        if value not in PRODUCTS:
            raise ValueError("Select a product from the collection.")
        return value

    @field_validator("options")
    @classmethod
    def supported_crystal_sizes(cls, value, info):
        if info.data.get("product_slug") != "photo-crystal-collection":
            return value
        shape = value.get("Crystal shape", "")
        supported = {
          "Rectangle tall": {"Small", "Medium", "Large", "XLarge", "Mini Mantel (6 × 4 in)"},
          "Rectangle wide": {"Small", "Medium", "Large", "XLarge", "Mini Mantel (6 × 4 in)"},
          "Heart": {"Small", "Medium", "Large"}, "Cut corner diamond": {"Small", "Medium", "Large"},
          "Prestige Iceberg small": {"Small only"}, "Dog bone": {"6 × 4 in"},
          "Candle": {"4 × 2.4 × 2.4 in"}, "Small notched": {"Size confirmed during review"},
          "Circle ornament": {"Size confirmed during review"}, "Heart keychain": {"3.5 × 3.5 × 1.2 cm"},
          "Rectangle keychain": {"3 × 2 × 1.5 cm"}, "2D heart necklace": {"3.5 × 3.5 × 0.8 cm"},
          "2D rectangle necklace": {"3 × 4 cm"},
        }
        if shape not in supported or value.get("Size") not in supported[shape]:
            raise ValueError("Choose a supported crystal shape and size.")
        return value


class Inquiry(StrictModel):
    request_id: UUID
    kind: Literal["retail", "bulk", "event", "contact"]
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(default="", max_length=30)
    organization: str = Field(default="", max_length=150)
    occasion: str = Field(default="", max_length=100)
    date: CalendarDate | None = None
    location: str = Field(default="", max_length=250)
    guests: StrictInt | None = Field(default=None, ge=1, le=100000)
    quantity: StrictInt | None = Field(default=None, ge=1, le=100000)
    category: str = Field(default="", max_length=80)
    design_type: str = Field(default="", max_length=100)
    budget: str = Field(default="", max_length=100)
    details: str = Field(default="", max_length=3000)
    delivery: str = Field(default="", max_length=100)
    shipping: dict[Annotated[str, Field(max_length=40)], Short] = Field(default_factory=dict, max_length=6)
    items: list[Item] = Field(default_factory=list, max_length=100)
    notes: str = Field(default="", max_length=1500)
    gift: StrictBool = False
    recipient: str = Field(default="", max_length=100)
    gift_message: str = Field(default="", max_length=300)
    consent: StrictBool

    @field_validator("name")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Please enter a name.")
        return value.strip()

    @field_validator("email")
    @classmethod
    def email_shape(cls, value):
        value = value.strip()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Please enter a valid email address.")
        return value

    @field_validator("date", mode="before")
    @classmethod
    def empty_date(cls, value):
        return None if value == "" else value

    @field_validator("consent")
    @classmethod
    def explicit_consent(cls, value):
        if value is not True:
            raise ValueError("Consent is required to submit a request.")
        return value


def create_request(body: Inquiry, kinds: set[str]):
    if body.kind not in kinds or (body.kind == "retail" and not body.items):
        raise HTTPException(422, "The request details do not match this workflow.")
    document = body.model_dump(mode="json")
    fingerprint = sha256(json.dumps(document, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    key = str(body.request_id)
    with database() as db:
        prior = db.execute("SELECT fingerprint, record_id FROM requests WHERE id=?", (key,)).fetchone()
        if prior:
            if prior[0] != fingerprint:
                raise HTTPException(409, "This request reference has already been used with different details.")
            return receipt(load(db, prior[1]))
        record_id = ("evt_" if body.kind == "event" else "msg_" if body.kind == "contact" else "quo_") + uuid4().hex
        document.update(id=record_id, version=1, status="submitted", created_at=NOW(), total_minor=None, currency="USD", next_step="The studio will review the request details.")
        event(document, "Request received")
        save(db, document)
        db.execute("INSERT INTO requests VALUES(?,?,?)", (key, fingerprint, record_id))
        return receipt(document)


@router.post("/v1/quotes", dependencies=[Depends(enabled)], tags=["requests"])
def submit_quote(body: Inquiry):
    return create_request(body, {"retail", "bulk"})


@router.post("/v1/events/requests", dependencies=[Depends(enabled)], tags=["requests"])
def submit_event(body: Inquiry):
    return create_request(body, {"event"})


@router.post("/v1/contact", dependencies=[Depends(enabled)], tags=["requests"])
def submit_contact(body: Inquiry):
    return create_request(body, {"contact"})


@router.get("/v1/quotes/{record_id}", dependencies=[Depends(enabled)], tags=["private"])
def get_quote(record_id: str, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        return private(db, record_id, authorization, {"retail", "bulk", "event", "contact"})


@router.get("/v1/orders/{record_id}", dependencies=[Depends(enabled)], tags=["private"])
def get_order(record_id: str, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        doc = private(db, record_id, authorization, {"order"})
        doc["test_payment_available"] = os.environ.get("SONORAN_TEST_PAYMENTS_ENABLED") == "true" and os.environ.get("STRIPE_SECRET_KEY", "").startswith("sk_test_")
        return doc


@router.get("/v1/proofs/{record_id}", dependencies=[Depends(enabled)], tags=["private"])
def get_proof(record_id: str, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        return private(db, record_id, authorization, {"proof"})


class Decision(StrictModel):
    version: StrictInt = Field(ge=1)
    decision: Literal["approve", "changes", "accept"]
    comment: str = Field(default="", max_length=1500)


@router.post("/v1/quotes/{record_id}/accept", dependencies=[Depends(enabled)], tags=["private"])
def accept_quote(record_id: str, body: Decision, authorization: Annotated[str | None, Header()] = None):
    with database() as db:
        doc = private(db, record_id, authorization, {"retail", "bulk", "event"})
        if body.version != doc["version"] or body.decision != "accept":
            raise HTTPException(409, "This quote version is no longer current.")
        if doc["status"] == "accepted":
            return doc
        if doc["status"] != "offered" or doc["total_minor"] is None:
            raise HTTPException(409, "The studio has not offered this quote.")
        doc.update(status="accepted", accepted_version=doc["version"], next_step="Quote accepted. Payment and any booking confirmation are separate steps.")
        event(doc, "Current quote accepted")
        save(db, doc)
        return doc


class Offer(StrictModel):
    version: StrictInt = Field(ge=1)
    total_minor: StrictInt = Field(ge=1, le=99999999)
    message: str = Field(min_length=1, max_length=3000)


@router.post("/v1/admin/quotes/{record_id}/offer", dependencies=[Depends(staff)], tags=["staff"])
def offer_quote(record_id: str, body: Offer):
    with database() as db:
        doc = load(db, record_id)
        if doc["kind"] not in {"retail", "bulk", "event"} or body.version != doc["version"] or doc.get("order_id"):
            raise HTTPException(409, "This request cannot be revised from that version.")
        doc.update(version=doc["version"]+1, total_minor=body.total_minor, message=body.message, status="offered", accepted_version=None, next_step="Review this exact quote version.")
        event(doc, "Quote version offered")
        save(db, doc)
        return doc


class OrderRequest(StrictModel):
    quote_id: str = Field(max_length=100)
    version: StrictInt = Field(ge=1)


@router.post("/v1/admin/orders", dependencies=[Depends(staff)], tags=["staff"])
def create_order(body: OrderRequest):
    with database() as db:
        quote = load(db, body.quote_id)
        if quote["kind"] not in {"retail", "bulk"} or quote["version"] != body.version or quote.get("accepted_version") != body.version:
            raise HTTPException(409, "An accepted current retail or bulk quote is required.")
        if quote.get("order_id"):
            return receipt(load(db, quote["order_id"]))
        doc = {"id":"ord_"+uuid4().hex, "kind":"order", "version":1, "status":"awaiting_payment", "created_at":NOW(), "quote_id":quote["id"], "quote_version":quote["version"], "total_minor":quote["total_minor"], "currency":"USD", "items":quote["items"], "payment_status":"unpaid", "proof_status":"awaiting_proof", "proof_required":True, "current_proof_id":None, "approved_proof_version":None, "inventory_reserved":False, "capacity_confirmed":False, "next_step":"Payment and a current approved proof are required before production."}
        event(doc, "Order prepared from accepted quote")
        save(db, doc)
        quote["order_id"] = doc["id"]
        save(db, quote)
        return receipt(doc)


class ProofRequest(StrictModel):
    order_id: str = Field(max_length=100)
    proof_text: str = Field(min_length=1, max_length=5000)
    expected_proof_version: StrictInt = Field(ge=0)


@router.post("/v1/admin/proofs", dependencies=[Depends(staff)], tags=["staff"])
def revise_proof(body: ProofRequest):
    with database() as db:
        order = load(db, body.order_id)
        if order["kind"] != "order" or order["status"] in {"in_production", "shipped"}:
            raise HTTPException(409, "This order cannot receive a proof revision.")
        old = load(db, order["current_proof_id"]) if order.get("current_proof_id") else None
        if (old["version"] if old else 0) != body.expected_proof_version:
            raise HTTPException(409, "The proof has changed. Reload the current version.")
        if old:
            doc = old
            doc.update(version=old["version"]+1, status="awaiting_approval", proof_text=body.proof_text, approved_version=None)
        else:
            doc = {"id":"prf_"+uuid4().hex, "kind":"proof", "version":1, "status":"awaiting_approval", "order_id":order["id"], "proof_text":body.proof_text, "created_at":NOW(), "approved_version":None}
        order.update(current_proof_id=doc["id"], current_proof_version=doc["version"], approved_proof_version=None, proof_status="awaiting_approval")
        if order["payment_status"] == "paid":
            order["status"] = "awaiting_approval"
        event(order, "Proof version prepared")
        save(db, doc)
        save(db, order)
        return receipt(doc)


def proof_decision(record_id: str, body: Decision, authorization: str | None, decision: str):
    with database() as db:
        doc = private(db, record_id, authorization, {"proof"})
        if body.version != doc["version"] or body.decision != decision:
            raise HTTPException(409, "This proof version is no longer current.")
        order = load(db, doc["order_id"])
        if order.get("current_proof_id") != doc["id"] or order.get("current_proof_version") != doc["version"]:
            raise HTTPException(409, "This is not the order's current proof.")
        if order["status"] in {"in_production", "shipped"}:
            raise HTTPException(409, "The piece has already been released for production. Contact the studio.")
        if decision == "approve":
            if doc["status"] == "approved":
                return doc
            if doc["status"] != "awaiting_approval":
                raise HTTPException(409, "The studio needs to prepare a new proof.")
            doc.update(status="approved", approved_version=doc["version"])
            order.update(proof_status="approved", approved_proof_version=doc["version"])
            if order["payment_status"] == "paid":
                order["status"] = "awaiting_production_checks"
            event(order, "Current proof approved")
        else:
            if not body.comment.strip():
                raise HTTPException(422, "Describe the requested change.")
            if doc["status"] == "changes_requested" and doc.get("change_request") == body.comment:
                return doc
            doc.update(status="changes_requested", change_request=body.comment, approved_version=None)
            order.update(proof_status="changes_requested", approved_proof_version=None)
            if order["payment_status"] == "paid":
                order["status"] = "changes_requested"
            event(order, "Proof change requested")
        save(db, doc)
        save(db, order)
        return doc


@router.post("/v1/proofs/{record_id}/approve", dependencies=[Depends(enabled)], tags=["private"])
def approve_proof(record_id: str, body: Decision, authorization: Annotated[str | None, Header()] = None):
    return proof_decision(record_id, body, authorization, "approve")


@router.post("/v1/proofs/{record_id}/changes", dependencies=[Depends(enabled)], tags=["private"])
def change_proof(record_id: str, body: Decision, authorization: Annotated[str | None, Header()] = None):
    return proof_decision(record_id, body, authorization, "changes")


class Release(StrictModel):
    version: StrictInt = Field(ge=1)
    inventory_reserved: StrictBool
    capacity_confirmed: StrictBool


@router.post("/v1/admin/orders/{record_id}/release", dependencies=[Depends(staff)], tags=["staff"])
def release_order(record_id: str, body: Release):
    with database() as db:
        doc = load(db, record_id)
        if doc["kind"] != "order" or doc["version"] != body.version:
            raise HTTPException(409, "The current order version is required.")
        current = doc.get("current_proof_version")
        approved = doc.get("approved_proof_version")
        gate = ProductionPrerequisites(payment_rule_satisfied=doc["payment_status"]=="paid", inventory_reserved=body.inventory_reserved, capacity_confirmed=body.capacity_confirmed, proof_required=doc["proof_required"], current_proof_version=str(current) if current else None, approved_proof_version=str(approved) if approved else None)
        if not gate.releasable():
            raise HTTPException(409, "Payment, current proof, inventory, and capacity prerequisites are not all satisfied.")
        if doc["status"] == "in_production":
            return doc
        if doc["status"] == "shipped":
            raise HTTPException(409, "This order has already shipped.")
        doc.update(status="in_production", inventory_reserved=True, capacity_confirmed=True, next_step="The studio has released this piece for production.")
        event(doc, "Released for production")
        save(db, doc)
        return doc


@router.get("/v1/admin/summary", dependencies=[Depends(staff)], tags=["staff"])
def summary():
    with database() as db:
        docs = [json.loads(row[0]) for row in db.execute("SELECT document FROM records").fetchall()]
        counts = {}
        for doc in docs:
            key = doc["status"]
            counts[key] = counts.get(key, 0)+1
        recent = sorted(docs, key=lambda d:d["created_at"], reverse=True)[:20]
        return {"counts":counts, "recent":[{key:d[key] for key in ("id","kind","status","created_at")} for d in recent]}


@router.get("/v1/admin/records/{record_id}", dependencies=[Depends(staff)], tags=["staff"])
def staff_record(record_id: str):
    with database() as db:
        return load(db, record_id)


class Shipment(StrictModel):
    version: StrictInt = Field(ge=1)
    carrier: str = Field(min_length=1, max_length=100)
    tracking: str = Field(min_length=1, max_length=200)


@router.post("/v1/admin/orders/{record_id}/ship", dependencies=[Depends(staff)], tags=["staff"])
def ship_order(record_id: str, body: Shipment):
    with database() as db:
        doc = load(db, record_id)
        if doc["kind"] != "order" or doc["version"] != body.version:
            raise HTTPException(409, "The current order version is required.")
        if doc["status"] == "shipped" and doc.get("shipment") == {"carrier":body.carrier,"tracking":body.tracking}:
            return doc
        if doc["status"] != "in_production":
            raise HTTPException(409, "Production release is required before dispatch.")
        doc.update(status="shipped", shipment={"carrier":body.carrier,"tracking":body.tracking}, next_step="The studio has recorded dispatch. Use the carrier and reference in your update.")
        event(doc, "Dispatched with " + body.carrier)
        save(db, doc)
        return doc


@router.get("/v1/capabilities", tags=["capabilities"])
def capabilities():
    active = os.environ.get("SONORAN_REQUESTS_ENABLED") == "true" and len(os.environ.get("SONORAN_ACCESS_SECRET", "")) >= 32
    return {"catalog":True, "local_request_workflow":active, "production_ready":False, "live_payments":False, "private_uploads":False, "live_email":False, "ai_required":False}
