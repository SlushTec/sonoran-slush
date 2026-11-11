"""Immutable commercial TEST FIXTURES. No owner approval or live catalog authority."""
import json
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import Field, StrictBool, StrictInt, field_validator, model_validator

from services.commerce.app.retail import Key, fingerprint, retail_enabled
from services.commerce.app.stock_ledger import Movement
from services.commerce.app.workflows import NOW, PRODUCTS, StrictModel, database, staff

router = APIRouter(prefix="/v1/admin/retail-test/commercial", tags=["commercial test fixtures"],
                   dependencies=[Depends(retail_enabled), Depends(staff)])
SCOPE = {"test_mode": True, "owner_approved": False, "production_approved": False}
Revision = Annotated[int, Path(ge=1, le=1000000)]
CounterVersion = Annotated[StrictInt, Field(ge=0, le=1000000)]


def schema(db):
    for sql in (
        "CREATE TABLE IF NOT EXISTS fixture_commercial_snapshots (id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved_test','retired_test')), lifecycle_version INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(id,revision))",
        "CREATE TABLE IF NOT EXISTS fixture_commercial_commands (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_commercial_sets (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_commercial_pointer (slot TEXT PRIMARY KEY CHECK(slot='current'), version INTEGER NOT NULL, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_commercial_publications (version INTEGER PRIMARY KEY, set_id TEXT NOT NULL, document TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS fixture_commercial_publication_sets ON fixture_commercial_publications(set_id)",
    ):
        db.execute(sql)


def audit(action, reason):
    return {"action": action, "reason": reason, "recorded_at": NOW(), "actor": "synthetic_staff",
            "actor_scope": "shared staff test credential; not an owner or individual reviewer"}


class CatalogRow(StrictModel):
    product_slug: Key
    fixture_eligible: StrictBool


class PriceRow(StrictModel):
    product_slug: Key
    variant_key: Key
    unit_price_minor: StrictInt = Field(ge=1, le=99999999)
    currency: Literal["USD"] = "USD"


class PolicyRow(StrictModel):
    policy_key: Key
    fixture_text: str = Field(min_length=1, max_length=4000)

    @field_validator("fixture_text")
    @classmethod
    def nonblank(cls, value):
        if not value.strip() or "\x00" in value:
            raise ValueError("Use nonblank fixture policy text.")
        return value


class DraftBase(StrictModel):
    request_id: UUID
    previous_revision: CounterVersion
    source_reference: Key


class CatalogDraft(DraftBase):
    kind: Literal["catalog"]
    rows: list[CatalogRow] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_rows(self):
        if len({x.product_slug for x in self.rows}) != len(self.rows):
            raise ValueError("Use each catalog product once.")
        return self


class PricesDraft(DraftBase):
    kind: Literal["prices"]
    rows: list[PriceRow] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_rows(self):
        if len({(x.product_slug, x.variant_key) for x in self.rows}) != len(self.rows):
            raise ValueError("Use each product/variant price once.")
        return self


class PoliciesDraft(DraftBase):
    kind: Literal["policies"]
    rows: list[PolicyRow] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_rows(self):
        if len({x.policy_key for x in self.rows}) != len(self.rows):
            raise ValueError("Use each fixture policy key once.")
        return self


Draft = Annotated[CatalogDraft | PricesDraft | PoliciesDraft, Field(discriminator="kind")]


def replay(db, request_id, payload):
    from services.commerce.app.commercial_fixture_validation import parse_document, checked_receipt
    digest = fingerprint(payload)
    row = db.execute("SELECT fingerprint,document FROM fixture_commercial_commands WHERE request_id=?", (str(request_id),)).fetchone()
    if row and row[0] != digest:
        raise HTTPException(409, "Commercial fixture command identity was reused with different contents.")
    if row:
        document = parse_document(row[1], "command receipt")
        return digest, checked_receipt({**document, **SCOPE}, payload)
    return digest, None

def record(db, request_id, digest, result):
    db.execute("INSERT INTO fixture_commercial_commands VALUES(?,?,?)", (str(request_id), digest, json.dumps(result)))


def read_snapshot(db, snapshot_id, revision):
    from services.commerce.app.commercial_fixture_validation import parse_document, checked_snapshot
    row = db.execute("SELECT kind,status,lifecycle_version,document FROM fixture_commercial_snapshots WHERE id=? AND revision=?", (snapshot_id, revision)).fetchone()
    if row is None:
        raise HTTPException(404, "Commercial fixture snapshot not found.")
    doc = parse_document(row[3], "snapshot content")
    return checked_snapshot(doc, snapshot_id, revision, row[0], row[1], row[2])

def content(document):
    return {k: document[k] for k in ("id", "revision", "kind", "source_reference", "rows")}


@router.post("/snapshots/{snapshot_id}/versions/{revision}")
def create_snapshot(snapshot_id: Key, revision: Revision, body: Draft):
    payload = {"operation": "create_snapshot", "id": snapshot_id, "revision": revision, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, body.request_id, payload)
        if old:
            return old
        maximum = db.execute("SELECT COALESCE(MAX(revision),0) FROM fixture_commercial_snapshots WHERE id=?", (snapshot_id,)).fetchone()[0]
        if body.previous_revision != maximum or revision != maximum + 1:
            raise HTTPException(409, "Append the next immutable fixture revision using the current revision.")
        if maximum:
            previous_kind = db.execute("SELECT kind FROM fixture_commercial_snapshots WHERE id=? AND revision=?", (snapshot_id, maximum)).fetchone()[0]
            if previous_kind != body.kind:
                raise HTTPException(409, "A fixture identity cannot change commercial kind.")
        if body.kind != "policies" and any(row.product_slug not in PRODUCTS for row in body.rows):
            raise HTTPException(422, "Fixture rows require existing reference product identities.")
        rows = [row.model_dump(mode="json") for row in body.rows]
        document = {"id": snapshot_id, "revision": revision, "kind": body.kind, "source_reference": body.source_reference,
                    "rows": rows, "audit": [audit("draft_created", "Explicit synthetic fixture draft")], **SCOPE}
        db.execute("INSERT INTO fixture_commercial_snapshots VALUES(?,?,?,'draft',1,?)",
                   (snapshot_id, revision, body.kind, json.dumps(document)))
        result = {**document, "status": "draft", "lifecycle_version": 1}
        record(db, body.request_id, digest, result)
        return result


@router.get("/snapshots/{snapshot_id}/versions/{revision}")
def snapshot(snapshot_id: Key, revision: Revision):
    with database() as db:
        schema(db)
        return read_snapshot(db, snapshot_id, revision)


class Review(StrictModel):
    request_id: UUID
    expected_lifecycle_version: StrictInt = Field(ge=1, le=1000000)
    decision: Literal["approve_test", "retire_test"]
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def meaningful(cls, value):
        return Movement.meaningful_reason(value)


@router.post("/snapshots/{snapshot_id}/versions/{revision}/review-test")
def review_snapshot(snapshot_id: Key, revision: Revision, body: Review):
    payload = {"operation": "review_snapshot", "id": snapshot_id, "revision": revision, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, body.request_id, payload)
        if old:
            return old
        doc = read_snapshot(db, snapshot_id, revision)
        if doc["lifecycle_version"] != body.expected_lifecycle_version:
            raise HTTPException(409, "Current fixture lifecycle version required.")
        if ((body.decision == "approve_test" and doc["status"] != "draft")
                or (body.decision == "retire_test" and doc["status"] == "retired_test")):
            raise HTTPException(409, "Fixture lifecycle transition is not permitted.")
        status = "approved_test" if body.decision == "approve_test" else "retired_test"
        doc["audit"].append(audit(body.decision, body.reason))
        doc.update(status=status, lifecycle_version=doc["lifecycle_version"] + 1)
        db.execute("UPDATE fixture_commercial_snapshots SET status=?,lifecycle_version=?,document=? WHERE id=? AND revision=?",
                   (status, doc["lifecycle_version"], json.dumps(doc), snapshot_id, revision))
        record(db, body.request_id, digest, doc)
        return doc


class SnapshotRef(StrictModel):
    snapshot_id: Key
    revision: StrictInt = Field(ge=1, le=1000000)


class ReleaseSet(StrictModel):
    request_id: UUID
    catalog: SnapshotRef
    prices: SnapshotRef
    policies: SnapshotRef


def qualified_set(db, refs, expected_hashes=None):
    documents = {}
    hashes = {}
    for kind in ("catalog", "prices", "policies"):
        ref = refs[kind]
        doc = read_snapshot(db, ref["snapshot_id"], ref["revision"])
        if doc["kind"] != kind or doc["status"] != "approved_test":
            raise HTTPException(409, "Every fixture reference must have the exact kind and approved_test state.")
        documents[kind] = doc
        hashes[kind] = fingerprint(content(doc))
    if expected_hashes is not None and hashes != expected_hashes:
        raise HTTPException(409, "Immutable fixture content needs reconciliation.")
    eligible = {r["product_slug"] for r in documents["catalog"]["rows"] if r["fixture_eligible"]}
    priced = {r["product_slug"] for r in documents["prices"]["rows"]}
    if not eligible or eligible != priced:
        raise HTTPException(409, "Fixture eligibility and priced product identities must match exactly.")
    return documents, hashes


@router.post("/sets/{set_id}")
def create_set(set_id: Key, body: ReleaseSet):
    payload = {"operation": "create_set", "id": set_id, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, body.request_id, payload)
        if old:
            return old
        if db.execute("SELECT 1 FROM fixture_commercial_sets WHERE id=?", (set_id,)).fetchone():
            raise HTTPException(409, "Fixture release-set identities are immutable.")
        refs = {k: getattr(body, k).model_dump() for k in ("catalog", "prices", "policies")}
        _, hashes = qualified_set(db, refs)
        doc = {"id": set_id, "references": refs, "content_hashes": hashes,
               "audit": [audit("test_set_created", "Exact synthetic snapshot composition")],
               "unqualified_domains": ["options", "tax", "machine_profiles", "owner_identity", "production"], **SCOPE}
        db.execute("INSERT INTO fixture_commercial_sets VALUES(?,?)", (set_id, json.dumps(doc)))
        record(db, body.request_id, digest, doc)
        return doc


def read_set(db, set_id):
    from services.commerce.app.commercial_fixture_validation import parse_document, checked_manifest
    row = db.execute("SELECT document FROM fixture_commercial_sets WHERE id=?", (set_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Commercial fixture set not found.")
    return checked_manifest(parse_document(row[0], "set content"), set_id)


@router.get("/sets/{set_id}")
def historical_set(set_id: Key):
    with database() as db:
        schema(db)
        return {"historical_manifest_only": True, **read_set(db, set_id)}


class SelectSet(StrictModel):
    request_id: UUID
    expected_pointer_version: CounterVersion
    set_id: Key
    action: Literal["publish_test", "rollback_test"]
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def meaningful(cls, value):
        return Movement.meaningful_reason(value)


@router.post("/current-test")
def select_set(body: SelectSet):
    payload = {"operation": "select_set", **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, body.request_id, payload)
        if old:
            return old
        current = db.execute("SELECT version FROM fixture_commercial_pointer WHERE slot='current'").fetchone()
        version = current[0] if current else 0
        if version != body.expected_pointer_version:
            raise HTTPException(409, "Current test pointer version required.")
        if version >= 1000000:
            raise HTTPException(409, "Fixture pointer version limit reached; reconcile before continuing.")
        if body.action == "rollback_test" and (current is None or not db.execute("SELECT 1 FROM fixture_commercial_publications WHERE set_id=?", (body.set_id,)).fetchone()):
            raise HTTPException(409, "Rollback requires a previously published test set.")
        manifest = read_set(db, body.set_id)
        qualified_set(db, manifest["references"], manifest["content_hashes"])
        doc = {"set_id": body.set_id, "pointer_version": version + 1,
               "audit": audit(body.action, body.reason), **SCOPE}
        db.execute("INSERT INTO fixture_commercial_pointer VALUES('current',?,?) ON CONFLICT(slot) DO UPDATE SET version=excluded.version,document=excluded.document",
                   (version + 1, json.dumps(doc)))
        db.execute("INSERT INTO fixture_commercial_publications VALUES(?,?,?)", (version + 1, body.set_id, json.dumps(doc)))
        record(db, body.request_id, digest, doc)
        return doc


@router.get("/current-test")
def current_set():
    with database() as db:
        schema(db)
        row = db.execute("SELECT version,document FROM fixture_commercial_pointer WHERE slot='current'").fetchone()
        if row is None:
            raise HTTPException(404, "No current commercial test set.")
        from services.commerce.app.commercial_fixture_validation import parse_document, checked_pointer
        pointer = checked_pointer(parse_document(row[1], "pointer content"), row[0])
        history = db.execute("SELECT set_id,document FROM fixture_commercial_publications WHERE version=?", (row[0],)).fetchone()
        if history is None or history[0] != pointer["set_id"]:
            raise HTTPException(409, "Fixture publication history needs reconciliation.")
        previous = checked_pointer(parse_document(history[1], "publication history"), row[0], pointer["set_id"])
        if previous != pointer:
            raise HTTPException(409, "Fixture publication provenance needs reconciliation.")
        manifest = read_set(db, pointer["set_id"])
        documents, _ = qualified_set(db, manifest["references"], manifest["content_hashes"])
        return {**pointer, "manifest": manifest, "snapshots": documents, **SCOPE}
