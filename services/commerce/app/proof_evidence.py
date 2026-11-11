"""Proof-specific immutable evidence for local workflows, not manufacturing approval."""
from hashlib import sha256
import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import AwareDatetime, Field, StrictInt, ValidationError, TypeAdapter

from services.commerce.app.workflows import StrictModel, Item, NOW, database, enabled, private, staff

MAX_CONTEXT = 32 * 1024 * 1024
LIMITATIONS = "Local text/configuration evidence only; no image/export, physical, identity or machine qualification."
router = APIRouter()


def fail():
    return HTTPException(409, "Proof evidence or material configuration needs reconciliation; prepare a fresh bound revision.")


def canonical(value):
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, UnicodeError, OverflowError, RecursionError):
        raise fail() from None


def parsed(value):
    if not isinstance(value, str):
        raise fail()
    try:
        result = json.loads(value)
    except (ValueError, TypeError, RecursionError):
        raise fail() from None
    if not isinstance(result, dict):
        raise fail()
    return result


class MaterialLine(StrictModel):
    item: dict
    offer_version: StrictInt = Field(ge=1)
    unit_price_minor: StrictInt = Field(ge=1, le=99999999)
    line_total_minor: StrictInt = Field(ge=1, le=99999999)
    stock_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    stock_units: StrictInt = Field(ge=1, le=50000)
    personalization_snapshot: dict | None = None


class Material(StrictModel):
    order_id: str = Field(min_length=1, max_length=100)
    items: list[dict] = Field(min_length=1, max_length=100)
    lines: list[MaterialLine] | None
    total_minor: StrictInt = Field(ge=1, le=99999999)
    currency: Literal["USD"]


def material(order):
    from services.commerce.app.retail import RetailItem
    from services.commerce.app.piece_personalization import validate_stored_snapshot
    try:
        context = {"order_id": order["id"], "items": order["items"], "lines": order.get("lines"),
                   "total_minor": order["total_minor"], "currency": order["currency"]}
        m = Material.model_validate(context)
        for item in m.items:
            (RetailItem if m.lines is not None else Item).model_validate(item)
        if m.lines is not None:
            if len(m.lines) != len(m.items):
                raise fail()
            total = 0
            for index, line in enumerate(m.lines):
                if canonical(line.item) != canonical(m.items[index]):
                    raise fail()
                if line.line_total_minor != line.unit_price_minor * m.items[index]["quantity"]:
                    raise fail()
                total += line.line_total_minor
            if total != m.total_minor:
                raise fail()
            validate_stored_snapshot(context["lines"], context["items"])
    except (KeyError, ValidationError, TypeError, ValueError, AttributeError):
        raise fail() from None
    data = canonical(context)
    if len(data) > MAX_CONTEXT:
        raise HTTPException(409, "Stored proof material exceeds the supported evidence bound.")
    return context, data, sha256(data).hexdigest()


def schema(db):
    db.execute("CREATE TABLE IF NOT EXISTS proof_material_contexts (hash TEXT PRIMARY KEY, order_id TEXT NOT NULL, document TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS proof_revision_evidence (proof_id TEXT NOT NULL, version INTEGER NOT NULL, order_id TEXT NOT NULL, context_hash TEXT NOT NULL, prepared_at TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(proof_id,version))")
    db.execute("CREATE TABLE IF NOT EXISTS proof_decision_evidence (proof_id TEXT NOT NULL, version INTEGER NOT NULL, sequence INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(proof_id,version,sequence))")
    db.execute("CREATE TABLE IF NOT EXISTS proof_legacy_observations (proof_id TEXT NOT NULL, version INTEGER NOT NULL, captured_at TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(proof_id,version))")


def present(db):
    names = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    expected = {"proof_material_contexts", "proof_revision_evidence", "proof_decision_evidence", "proof_legacy_observations"}
    if names & expected and not expected <= names:
        raise fail()
    return expected <= names


class Revision(StrictModel):
    schema_version: Literal[1]
    proof_id: str
    order_id: str
    version: StrictInt = Field(ge=1, le=1000)
    proof_text: str = Field(min_length=1, max_length=5000)
    context_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    prepared_at: AwareDatetime
    actor_scope: Literal["shared synthetic staff credential"]
    limitations: Literal["Local text/configuration evidence only; no image/export, physical, identity or machine qualification."]


class EvidenceDecision(StrictModel):
    schema_version: Literal[1]
    proof_id: str
    order_id: str
    version: StrictInt = Field(ge=1, le=1000)
    context_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    sequence: StrictInt = Field(ge=1, le=1000)
    action: Literal["approve", "changes"]
    comment: str = Field(max_length=1500)
    recorded_at: AwareDatetime
    actor_scope: Literal["holder of this private proof capability"]


def checked(model, value):
    if type(value.get("schema_version")) is not int:
        raise fail()
    try:
        model.model_validate(value)
    except (ValidationError, TypeError, ValueError):
        raise fail() from None
    for key in ("prepared_at", "recorded_at"):
        if key in value:
            valid_timestamp(value[key])
    canonical(value)  # Also rejects legacy unpaired surrogates without a transport crash.
    return value


def revision(db, proof_id, version):
    if not present(db):
        raise fail()
    row = db.execute("SELECT order_id,context_hash,prepared_at,document FROM proof_revision_evidence WHERE proof_id=? AND version=?", (proof_id, version)).fetchone()
    if row is None:
        raise fail()
    doc = checked(Revision, parsed(row[3]))
    if (doc["proof_id"], doc["version"], doc["order_id"], doc["context_hash"], doc["prepared_at"]) != (proof_id, version, row[0], row[1], row[2]):
        raise fail()
    return doc


def context_for(db, rev):
    meta = db.execute("SELECT order_id,typeof(document),length(CAST(document AS BLOB)) FROM proof_material_contexts WHERE hash=?", (rev["context_hash"],)).fetchone()
    if meta is None or meta[0] != rev["order_id"] or meta[1] != "text" or type(meta[2]) is not int or not 1 <= meta[2] <= MAX_CONTEXT:
        raise fail()
    row = db.execute("SELECT order_id,document FROM proof_material_contexts WHERE hash=?", (rev["context_hash"],)).fetchone()
    if row is None or row[0] != rev["order_id"]:
        raise fail()
    context = parsed(row[1])
    # Validate stored exact material through the same bounded schema as live order.
    order = {**context, "id": context.get("order_id")}
    _, data, digest = material(order)
    if digest != rev["context_hash"] or data.decode("utf-8") != row[1] or context.get("order_id") != rev["order_id"]:
        raise fail()
    return context


def decisions(db, rev):
    rows = db.execute("SELECT sequence,document FROM proof_decision_evidence WHERE proof_id=? AND version=? ORDER BY sequence LIMIT 1001", (rev["proof_id"], rev["version"])).fetchall()
    if len(rows) > 1000:
        raise fail()
    result = []
    for expected, (sequence, raw) in enumerate(rows, 1):
        doc = checked(EvidenceDecision, parsed(raw))
        if sequence != expected or (doc["proof_id"], doc["order_id"], doc["version"], doc["context_hash"], doc["sequence"]) != (rev["proof_id"], rev["order_id"], rev["version"], rev["context_hash"], expected):
            raise fail()
        if result and result[-1]["action"] == doc["action"]:
            raise fail()
        result.append(doc)
    return result


def verify(db, proof, order, live=True):
    try:
        if (proof.get("kind") != "proof" or type(proof.get("binding_schema")) is not int
                or proof.get("binding_schema") != 1 or type(proof.get("version")) is not int):
            raise fail()
        rev = revision(db, proof["id"], proof["version"])
        if (proof["order_id"] != order["id"] or rev["order_id"] != order["id"]
                or proof.get("proof_text") != rev["proof_text"]
                or proof.get("context_hash") != rev["context_hash"]
                or type(order.get("current_proof_version")) is not int
                or order.get("current_proof_id") != proof["id"]
                or order.get("current_proof_version") != proof["version"]):
            raise fail()
        context_for(db, rev)
        if live and material(order)[2] != rev["context_hash"]:
            raise fail()
        history = decisions(db, rev)
        status = proof.get("status")
        if status == "awaiting_approval":
            if history or proof.get("approved_version") is not None:
                raise fail()
        elif status == "approved":
            if (not history or history[-1]["action"] != "approve"
                    or type(proof.get("approved_version")) is not int
                    or proof.get("approved_version") != proof["version"]):
                raise fail()
        elif status == "changes_requested":
            if not history or history[-1]["action"] != "changes" or proof.get("change_request") != history[-1]["comment"] or proof.get("approved_version") is not None:
                raise fail()
        else:
            raise fail()
        return rev, history
    except (KeyError, TypeError, ValueError, AttributeError):
        raise fail() from None


def prepare(db, order, old, proof, text):
    schema(db)
    if proof["version"] > 1000:
        raise HTTPException(409, "Technical proof revision limit reached; reconcile before preparing more.")
    # Avoid accepting new proof wording that cannot be emitted as UTF8.
    canonical(text)
    if old:
        if old.get("kind") != "proof" or type(old.get("version")) is not int or old["version"] < 1:
            raise fail()
        if old.get("binding_schema") is not None:
            verify(db, old, order, live=False)
        else:
            # Preserve exactly the one legacy document retained, not fabricated prior history.
            if order.get("current_proof_id") != old.get("id") or order.get("current_proof_version") != old.get("version"):
                raise fail()
            raw = json.dumps(old, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
            existing = db.execute("SELECT document FROM proof_legacy_observations WHERE proof_id=? AND version=?", (old["id"], old["version"])).fetchone()
            if existing and existing[0] != raw:
                raise fail()
            if existing is None:
                db.execute("INSERT INTO proof_legacy_observations VALUES(?,?,?,?)", (old["id"], old["version"], NOW(), raw))
    context, data, digest = material(order)
    stored = db.execute("SELECT order_id,document FROM proof_material_contexts WHERE hash=?", (digest,)).fetchone()
    if stored:
        if stored != (order["id"], data.decode("utf-8")):
            raise fail()
    else:
        db.execute("INSERT INTO proof_material_contexts VALUES(?,?,?)", (digest, order["id"], data.decode("utf-8")))
    doc = {"schema_version": 1, "proof_id": proof["id"], "order_id": order["id"], "version": proof["version"],
           "proof_text": text, "context_hash": digest, "prepared_at": NOW(),
           "actor_scope": "shared synthetic staff credential", "limitations": LIMITATIONS}
    checked(Revision, doc)
    db.execute("INSERT INTO proof_revision_evidence VALUES(?,?,?,?,?,?)",
               (proof["id"], proof["version"], order["id"], digest, doc["prepared_at"], canonical(doc).decode("utf-8")))
    proof.update(binding_schema=1, context_hash=digest, limitations=LIMITATIONS)
    proof.pop("change_request", None)


def record_decision(db, rev, history, action, comment):
    if len(history) >= 1000:
        raise fail()
    doc = {"schema_version": 1, "proof_id": rev["proof_id"], "order_id": rev["order_id"],
           "version": rev["version"], "context_hash": rev["context_hash"], "sequence": len(history)+1,
           "action": action, "comment": comment, "recorded_at": NOW(),
           "actor_scope": "holder of this private proof capability"}
    checked(EvidenceDecision, doc)
    db.execute("INSERT INTO proof_decision_evidence VALUES(?,?,?,?)",
               (rev["proof_id"], rev["version"], doc["sequence"], canonical(doc).decode("utf-8")))


Cursor = Annotated[int, Query(ge=0, le=1000)]
PageSize = Annotated[int, Query(ge=1, le=25)]


def valid_timestamp(value):
    if (not isinstance(value, str) or len(value) < 20 or value[10] != "T"
            or value[4] != "-" or value[7] != "-"):
        raise fail()
    try:
        TypeAdapter(AwareDatetime).validate_python(value)
    except (ValidationError, ValueError, TypeError):
        raise fail() from None
    return value


def checked_private_proof(proof, record_id):
    if not isinstance(proof, dict) or proof.get("id") != record_id or proof.get("kind") != "proof" or not isinstance(proof.get("order_id"), str):
        raise fail()
    return proof


def history_page(db, proof, after, limit):
    if not present(db):
        return {"proof_id": proof["id"], "items": [], "next_cursor": None, "legacy_history_unknown": True}
    # Summaries deliberately select no context or revision document blobs.
    rows = db.execute("SELECT version,context_hash,prepared_at,order_id FROM proof_revision_evidence WHERE proof_id=? AND version>? ORDER BY version LIMIT ?",
                      (proof["id"], after, limit+1)).fetchall()
    items = []
    for version, digest, at, order_id in rows[:limit]:
        if type(version) is not int or not 1 <= version <= 1000 or order_id != proof["order_id"]:
            raise fail()
        if not isinstance(digest, str) or len(digest) != 64 or any(x not in "0123456789abcdef" for x in digest):
            raise fail()
        items.append({"version": version, "context_hash": digest, "prepared_at": valid_timestamp(at)})
    legacy = db.execute("SELECT version,captured_at FROM proof_legacy_observations WHERE proof_id=? ORDER BY version LIMIT 1", (proof["id"],)).fetchone()
    if legacy:
        if type(legacy[0]) is not int or legacy[0] < 1:
            raise fail()
        valid_timestamp(legacy[1])
    return {"proof_id": proof["id"], "items": items, "next_cursor": items[-1]["version"] if len(rows)>limit else None,
            "legacy_history_unknown": bool(legacy) or proof.get("binding_schema") != 1,
            "legacy_observation": {"version":legacy[0], "captured_at":legacy[1], "unbound":True} if legacy else None}


@router.get("/v1/proofs/{record_id}/history", dependencies=[Depends(enabled)], tags=["private"])
def proof_history(record_id: str, authorization: Annotated[str | None, Header()] = None,
                  after: Cursor = 0, limit: PageSize = 25):
    with database() as db:
        proof = checked_private_proof(private(db, record_id, authorization, {"proof"}), record_id)
        return history_page(db, proof, after, limit)


@router.get("/v1/proofs/{record_id}/history/{version}", dependencies=[Depends(enabled)], tags=["private"])
def proof_revision(record_id: str, version: int, authorization: Annotated[str | None, Header()] = None):
    if not 1 <= version <= 1000:
        raise HTTPException(422, "Use a supported exact revision.")
    with database() as db:
        proof = checked_private_proof(private(db, record_id, authorization, {"proof"}), record_id)
        rev = revision(db, record_id, version)
        if rev["order_id"] != proof["order_id"]:
            raise fail()
        return {"revision": rev, "material_context": context_for(db, rev), "decisions": decisions(db, rev)}
