"""Disconnected fixture BOMs and reservations; never checkout/manufacturing authority."""
import json
from collections import Counter
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field, StrictInt, field_validator, model_validator

from services.commerce.app.stock_ledger import (
    schema as ledger_schema, Key, SCOPE, MAX_UNITS, Bucket, Movement,
    existing_lot, balance, apply_leg,
)
from services.commerce.app.retail import fingerprint, retail_enabled
from services.commerce.app.workflows import NOW, PRODUCTS, StrictModel, database, staff

router = APIRouter(prefix="/v1/admin/retail-test/component-ledger", tags=["synthetic component reservations"], dependencies=[Depends(retail_enabled), Depends(staff)])

VersionNumber = Annotated[StrictInt, Field(ge=0, le=9223372036854775806)]
Revision = Annotated[int, Path(ge=1, le=1000000)]


def schema(db):
    ledger_schema(db)
    for sql in (
        "CREATE TABLE IF NOT EXISTS fixture_boms (id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(id,revision))",
        "CREATE TABLE IF NOT EXISTS fixture_holds (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_allocations (hold_id TEXT NOT NULL, lot_id TEXT NOT NULL, location_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0 AND units<=1000000), state TEXT NOT NULL CHECK(state IN ('active','released','consumed')), PRIMARY KEY(hold_id,lot_id,location_id))",
        "CREATE INDEX IF NOT EXISTS fixture_allocations_active ON fixture_allocations(lot_id,location_id,state)",
        "CREATE TABLE IF NOT EXISTS fixture_hold_commands (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_hold_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL, lot_id TEXT NOT NULL, document TEXT NOT NULL, UNIQUE(request_id,lot_id))",
        "CREATE INDEX IF NOT EXISTS fixture_hold_events_by_lot ON fixture_hold_events(lot_id,sequence)",
    ):
        db.execute(sql)


def reserved_units(db, lot_id, location_id):
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fixture_allocations'").fetchone():
        return 0
    return db.execute("SELECT COALESCE(SUM(units),0) FROM fixture_allocations WHERE lot_id=? AND location_id=? AND state='active'", (lot_id, location_id)).fetchone()[0]


def hold_identity_exists(db, request_id):
    return (db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fixture_hold_commands'").fetchone()
            and db.execute("SELECT 1 FROM fixture_hold_commands WHERE request_id=?", (request_id,)).fetchone())


class Need(StrictModel):
    component_id: Key
    units_per_item: StrictInt = Field(ge=1, le=MAX_UNITS)


class Bill(StrictModel):
    product_slug: Key
    components: list[Need] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def distinct_components(self):
        if len({x.component_id for x in self.components}) != len(self.components):
            raise ValueError("Use each component once in a fixture BOM.")
        return self


@router.put("/boms/{bom_id}/versions/{revision}")
def define_bom(bom_id: Key, revision: Revision, body: Bill):
    if body.product_slug not in PRODUCTS:
        raise HTTPException(422, "Select an existing reference listing for this fixture BOM.")
    with database() as db:
        schema(db)
        components = []
        for need in sorted(body.components, key=lambda x: x.component_id):
            row = db.execute("SELECT document FROM fixture_components WHERE id=?", (need.component_id,)).fetchone()
            if row is None:
                raise HTTPException(409, "Define every synthetic component first.")
            components.append({**need.model_dump(), "unit": json.loads(row[0])["unit"]})
        document = {"id": bom_id, "revision": revision, "product_slug": body.product_slug, "components": components, **SCOPE}
        old = db.execute("SELECT document FROM fixture_boms WHERE id=? AND revision=?", (bom_id, revision)).fetchone()
        if old:
            if json.loads(old[0]) != document:
                raise HTTPException(409, "BOM versions are immutable; use a new revision.")
        else:
            db.execute("INSERT INTO fixture_boms VALUES(?,?,?)", (bom_id, revision, json.dumps(document)))
        return document


def get_bom(db, bom_id, revision):
    row = db.execute("SELECT document FROM fixture_boms WHERE id=? AND revision=?", (bom_id, revision)).fetchone()
    if row is None:
        raise HTTPException(404, "Fixture BOM version not found.")
    return json.loads(row[0])


@router.get("/boms/{bom_id}/versions/{revision}")
def read_bom(bom_id: Key, revision: Revision):
    with database() as db:
        schema(db)
        return get_bom(db, bom_id, revision)


class Allocation(StrictModel):
    lot_id: Key
    location_id: Key
    units: StrictInt = Field(ge=1, le=MAX_UNITS)


class Plan(StrictModel):
    quantity: StrictInt = Field(ge=1, le=500)
    allocations: list[Allocation] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def distinct_buckets(self):
        if len({(x.lot_id, x.location_id) for x in self.allocations}) != len(self.allocations):
            raise ValueError("Combine repeated allocations of the same lot and location.")
        return self


def allocation_plan(db, bom_id, revision, body):
    bom = get_bom(db, bom_id, revision)
    needs = {x["component_id"]: x["units_per_item"] * body.quantity for x in bom["components"]}
    if any(x > MAX_UNITS for x in needs.values()):
        raise HTTPException(422, "Fixture BOM requirements exceed supported quantities.")
    units = {x["component_id"]: x["unit"] for x in bom["components"]}
    actual = Counter()
    lot_versions = {}
    details = []
    for allocation in sorted(body.allocations, key=lambda x: (x.lot_id, x.location_id)):
        lot, version = existing_lot(db, allocation.lot_id)
        component_id = lot["component_id"]
        if component_id not in needs:
            raise HTTPException(409, "An allocation does not match this BOM's components.")
        component = db.execute("SELECT document FROM fixture_components WHERE id=?", (component_id,)).fetchone()
        if component is None or json.loads(component[0])["unit"] != units[component_id]:
            raise HTTPException(409, "Fixture component unit needs reconciliation.")
        if not db.execute("SELECT 1 FROM fixture_locations WHERE id=?", (allocation.location_id,)).fetchone():
            raise HTTPException(409, "Fixture allocation location not found.")
        physical = balance(db, allocation.lot_id, Bucket(location_id=allocation.location_id, condition="available"))
        reserved = reserved_units(db, allocation.lot_id, allocation.location_id)
        free = physical - reserved
        if free < allocation.units:
            raise HTTPException(409, "Insufficient unreserved fixture components.")
        actual[component_id] += allocation.units
        lot_versions[allocation.lot_id] = version
        details.append({**allocation.model_dump(), "component_id": component_id, "unit": units[component_id],
                        "physical_units": physical, "reserved_units": reserved, "free_units": free})
    if dict(actual) != needs:
        raise HTTPException(409, "Allocations must satisfy every BOM component exactly.")
    return {"bom": bom, "quantity": body.quantity, "allocations": details, "lot_versions": lot_versions, **SCOPE}


@router.post("/boms/{bom_id}/versions/{revision}/plan")
def plan_bom(bom_id: Key, revision: Revision, body: Plan):
    with database() as db:
        schema(db)
        return allocation_plan(db, bom_id, revision, body)


class Reserve(Plan):
    request_id: UUID
    lot_versions: dict[Key, VersionNumber] = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def reason_is_meaningful(cls, value):
        return Movement.meaningful_reason(value)


class Transition(StrictModel):
    request_id: UUID
    expected_version: StrictInt = Field(ge=1, le=9223372036854775806)
    lot_versions: dict[Key, VersionNumber] = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def reason_is_meaningful(cls, value):
        return Movement.meaningful_reason(value)


def command_replay(db, request_id, payload):
    digest = fingerprint(payload)
    key = str(request_id)
    # All fixture operations share one command namespace.
    from services.commerce.app.incoming_inspection import identity_exists
    if identity_exists(db, key):
        raise HTTPException(409, "Command identity already belongs to an intake operation.")
    if db.execute("SELECT 1 FROM fixture_movements WHERE request_id=?", (key,)).fetchone():
        raise HTTPException(409, "Command identity already belongs to a stock movement.")
    row = db.execute("SELECT fingerprint,document FROM fixture_hold_commands WHERE request_id=?", (key,)).fetchone()
    if row and row[0] != digest:
        raise HTTPException(409, "Command identity was reused with different contents.")
    return digest, json.loads(row[1]) if row else None


def record_command(db, request_id, digest, document):
    db.execute("INSERT INTO fixture_hold_commands VALUES(?,?,?)", (str(request_id), digest, json.dumps(document)))
    for lot_id in sorted({a["lot_id"] for a in document["allocations"]}):
        event = {"hold_id": document["id"], "request_id": str(request_id), "state": document["state"],
                 "hold_version": document["version"], "lot_id": lot_id, "lot_version": existing_lot(db, lot_id)[1],
                 "allocations": [a for a in document["allocations"] if a["lot_id"] == lot_id],
                 "audit": document["audit"][-1], **SCOPE}
        db.execute("INSERT INTO fixture_hold_events(request_id,lot_id,document) VALUES(?,?,?)", (str(request_id), lot_id, json.dumps(event)))


def verify_versions(expected, actual):
    if expected != actual:
        raise HTTPException(409, "Every affected lot's current version is required.")


def bump_lots(db, versions):
    for lot_id in versions:
        result = db.execute("UPDATE fixture_lots SET version=version+1 WHERE id=?", (lot_id,))
        if result.rowcount != 1:
            raise HTTPException(409, "Fixture lot version needs reconciliation.")


def audit(action, reason):
    return {"action": action, "reason": reason, "recorded_at": NOW(), "actor": "synthetic_staff",
            "actor_scope": "shared staff test credential; not individual identity"}


@router.post("/boms/{bom_id}/versions/{revision}/reservations")
def reserve_bom(bom_id: Key, revision: Revision, body: Reserve):
    payload = {"operation": "reserve", "bom_id": bom_id, "revision": revision, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, replay = command_replay(db, body.request_id, payload)
        if replay:
            return replay
        plan = allocation_plan(db, bom_id, revision, body)
        verify_versions(body.lot_versions, plan["lot_versions"])
        hold_id = "fixture_hold_" + uuid4().hex
        allocations = [{k: a[k] for k in ("lot_id", "location_id", "units", "component_id", "unit")} for a in plan["allocations"]]
        document = {"id": hold_id, "state": "active", "version": 1, "bom": plan["bom"], "quantity": body.quantity,
                    "allocations": allocations, "audit": [audit("reserved", body.reason)], **SCOPE}
        for a in allocations:
            db.execute("INSERT INTO fixture_allocations VALUES(?,?,?,?, 'active')", (hold_id, a["lot_id"], a["location_id"], a["units"]))
        bump_lots(db, plan["lot_versions"])
        db.execute("INSERT INTO fixture_holds VALUES(?,?)", (hold_id, json.dumps(document)))
        record_command(db, body.request_id, digest, document)
        return document


def load_hold(db, hold_id):
    row = db.execute("SELECT document FROM fixture_holds WHERE id=?", (hold_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Synthetic reservation not found.")
    return json.loads(row[0])


@router.get("/reservations/{hold_id}")
def read_hold(hold_id: Key):
    with database() as db:
        schema(db)
        return load_hold(db, hold_id)


def active_hold_versions(db, doc):
    expected = sorted((a["lot_id"], a["location_id"], a["units"]) for a in doc["allocations"])
    actual = db.execute("SELECT lot_id,location_id,units FROM fixture_allocations WHERE hold_id=? AND state='active' ORDER BY lot_id,location_id", (doc["id"],)).fetchall()
    if not expected or expected != actual:
        raise HTTPException(409, "Complete active fixture allocations need reconciliation.")
    return {lot_id: existing_lot(db, lot_id)[1] for lot_id, _, _ in expected}


def transition_hold(hold_id, body, target):
    payload = {"operation": target, "hold_id": hold_id, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, replay = command_replay(db, body.request_id, payload)
        if replay:
            return replay
        doc = load_hold(db, hold_id)
        if doc["version"] != body.expected_version or doc["state"] != "active":
            raise HTTPException(409, "A current active fixture reservation is required.")
        versions = active_hold_versions(db, doc)
        verify_versions(body.lot_versions, versions)
        db.execute("UPDATE fixture_allocations SET state=? WHERE hold_id=?", (target, hold_id))
        if target == "consumed":
            for a in doc["allocations"]:
                # Own hold has been removed in this transaction; all other holds remain protected.
                apply_leg(db, a["lot_id"], Bucket(location_id=a["location_id"], condition="available"), -a["units"])
                apply_leg(db, a["lot_id"], Bucket(location_id=a["location_id"], condition="in_production"), a["units"])
        bump_lots(db, versions)
        doc.update(state=target, version=doc["version"] + 1)
        doc["audit"].append(audit(target, body.reason))
        db.execute("UPDATE fixture_holds SET document=? WHERE id=?", (json.dumps(doc), hold_id))
        record_command(db, body.request_id, digest, doc)
        return doc


@router.post("/reservations/{hold_id}/release")
def release_hold(hold_id: Key, body: Transition):
    return transition_hold(hold_id, body, "released")


@router.post("/reservations/{hold_id}/consume")
def consume_hold(hold_id: Key, body: Transition):
    return transition_hold(hold_id, body, "consumed")


@router.get("/lots/{lot_id}/reservation-events")
def reservation_events(lot_id: Key, after: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
                       limit: Annotated[int, Query(ge=1, le=100)] = 50):
    with database() as db:
        schema(db)
        _, version = existing_lot(db, lot_id)
        rows = db.execute("SELECT sequence,document FROM fixture_hold_events WHERE lot_id=? AND sequence>? ORDER BY sequence LIMIT ?", (lot_id, after, limit + 1)).fetchall()
        page = rows[:limit]
        return {"lot_id": lot_id, "version": version, "events": [{"sequence": r[0], **json.loads(r[1])} for r in page],
                "next_after": page[-1][0] if len(rows) > limit else None, **SCOPE}
