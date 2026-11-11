"""Staff-only synthetic inventory ledger, deliberately NOT checkout stock authority."""
import json
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, StrictInt, field_validator, model_validator

from services.commerce.app.retail import Key, fingerprint, retail_enabled
from services.commerce.app.workflows import NOW, StrictModel, database, staff

router = APIRouter(prefix="/v1/admin/retail-test/component-ledger", tags=["synthetic component ledger"],
                   dependencies=[Depends(retail_enabled), Depends(staff)])
Condition = Literal["available", "damaged", "sample", "in_production", "completed", "shipped"]
SCOPE = {"test_mode": True, "checkout_authoritative": False}
MAX_UNITS = 1000000


def schema(db):
    for sql in (
        "CREATE TABLE IF NOT EXISTS fixture_components (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_locations (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_lots (id TEXT PRIMARY KEY, document TEXT NOT NULL, version INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS fixture_balances (lot_id TEXT NOT NULL, location_id TEXT NOT NULL, condition TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>=0 AND units<=1000000), PRIMARY KEY(lot_id,location_id,condition))",
        "CREATE TABLE IF NOT EXISTS fixture_movements (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, lot_id TEXT NOT NULL, document TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS fixture_movements_by_lot ON fixture_movements(lot_id,sequence)",
    ):
        db.execute(sql)


class Component(StrictModel):
    kind: Literal["blank", "base", "box", "consumable"]
    unit: Literal["piece", "millilitre", "gram", "millimetre"]


class Location(StrictModel):
    kind: Literal["workshop", "market"]


class Lot(StrictModel):
    component_id: Key
    supplier_reference: Key
    lot_reference: Key


def immutable(db, table, key, data):
    # Table names come only from this module, never from an HTTP parameter.
    old = db.execute(f"SELECT document FROM {table} WHERE id=?", (key,)).fetchone()
    document = {"id": key, **data, **SCOPE}
    if old:
        if json.loads(old[0]) != document:
            raise HTTPException(409, "Fixture definition is immutable; use a new identity.")
        return document
    if table == "fixture_lots":
        db.execute("INSERT INTO fixture_lots VALUES(?,?,0)", (key, json.dumps(document)))
    else:
        db.execute(f"INSERT INTO {table} VALUES(?,?)", (key, json.dumps(document)))
    return document


@router.put("/components/{component_id}")
def component(component_id: Key, body: Component):
    with database() as db:
        schema(db)
        return immutable(db, "fixture_components", component_id, body.model_dump())


@router.put("/locations/{location_id}")
def location(location_id: Key, body: Location):
    with database() as db:
        schema(db)
        return immutable(db, "fixture_locations", location_id, body.model_dump())


@router.put("/lots/{lot_id}")
def lot(lot_id: Key, body: Lot):
    with database() as db:
        schema(db)
        if not db.execute("SELECT 1 FROM fixture_components WHERE id=?", (body.component_id,)).fetchone():
            raise HTTPException(409, "Create the synthetic component first.")
        return immutable(db, "fixture_lots", lot_id, body.model_dump())


class Bucket(StrictModel):
    location_id: Key
    condition: Condition


class Movement(StrictModel):
    request_id: UUID
    expected_version: StrictInt = Field(ge=0)
    quantity: StrictInt = Field(ge=1, le=MAX_UNITS)
    source: Bucket | None = None
    destination: Bucket | None = None
    purpose: Literal["receipt", "transfer", "count_correction"]
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value):
        if not value.strip() or any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError("Use a nonblank single-line synthetic audit reason.")
        return value

    @model_validator(mode="after")
    def valid_legs(self):
        if self.source == self.destination:
            raise ValueError("A movement requires distinct source/destination buckets.")
        if self.purpose == "receipt" and (self.source is not None or self.destination is None):
            raise ValueError("A fixture receipt requires only a destination.")
        if self.purpose == "transfer" and (self.source is None or self.destination is None):
            raise ValueError("A transfer requires two buckets.")
        if self.purpose == "count_correction" and ((self.source is None) == (self.destination is None)):
            raise ValueError("A count correction requires exactly one bucket.")
        return self


def existing_lot(db, lot_id):
    row = db.execute("SELECT document,version FROM fixture_lots WHERE id=?", (lot_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Synthetic lot not found.")
    return json.loads(row[0]), row[1]


def balance(db, lot_id, bucket):
    row = db.execute("SELECT units FROM fixture_balances WHERE lot_id=? AND location_id=? AND condition=?",
                     (lot_id, bucket.location_id, bucket.condition)).fetchone()
    return row[0] if row else 0


def apply_leg(db, lot_id, bucket, delta):
    units = balance(db, lot_id, bucket) + delta
    if not 0 <= units <= MAX_UNITS:
        raise HTTPException(409, "Insufficient fixture balance or supported quantity limit exceeded.")
    db.execute("INSERT INTO fixture_balances VALUES(?,?,?,?) ON CONFLICT(lot_id,location_id,condition) DO UPDATE SET units=excluded.units",
               (lot_id, bucket.location_id, bucket.condition, units))


@router.post("/lots/{lot_id}/movements")
def movement(lot_id: Key, body: Movement):
    payload = {"lot_id": lot_id, **body.model_dump(mode="json")}
    digest = fingerprint(payload)
    with database() as db:
        schema(db)
        replay = db.execute("SELECT fingerprint,document FROM fixture_movements WHERE request_id=?", (str(body.request_id),)).fetchone()
        if replay:
            if replay[0] != digest:
                raise HTTPException(409, "Movement identity was reused with different contents.")
            return json.loads(replay[1])
        _, version = existing_lot(db, lot_id)
        if body.expected_version != version:
            raise HTTPException(409, "Synthetic lot version changed; review current balances.")
        for bucket in (body.source, body.destination):
            if bucket and not db.execute("SELECT 1 FROM fixture_locations WHERE id=?", (bucket.location_id,)).fetchone():
                raise HTTPException(409, "Create each synthetic location first.")
        if body.source:
            apply_leg(db, lot_id, body.source, -body.quantity)
        if body.destination:
            apply_leg(db, lot_id, body.destination, body.quantity)
        db.execute("UPDATE fixture_lots SET version=version+1 WHERE id=?", (lot_id,))
        document = {**payload, "version": version + 1, "recorded_at": NOW(),
                    "actor": "synthetic_staff", "actor_scope": "shared staff test credential; not individual identity", **SCOPE}
        db.execute("INSERT INTO fixture_movements(request_id,fingerprint,lot_id,document) VALUES(?,?,?,?)",
                   (str(body.request_id), digest, lot_id, json.dumps(document)))
        return document


@router.get("/lots/{lot_id}")
def lot_state(lot_id: Key, offset: Annotated[int, Query(ge=0, le=1000000000)] = 0, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    with database() as db:
        schema(db)
        document, version = existing_lot(db, lot_id)
        rows = db.execute("SELECT location_id,condition,units FROM fixture_balances WHERE lot_id=? ORDER BY location_id,condition LIMIT ? OFFSET ?", (lot_id, limit + 1, offset)).fetchall()
        return {**document, "version": version, "balances": [{"location_id": r[0], "condition": r[1], "units": r[2]} for r in rows[:limit]], "next_offset": offset + limit if len(rows) > limit else None}


@router.get("/lots/{lot_id}/movements")
def history(lot_id: Key, after: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0, limit: Annotated[int, Query(ge=1, le=100)] = 50):
    with database() as db:
        schema(db)
        _, version = existing_lot(db, lot_id)
        rows = db.execute("SELECT sequence,document FROM fixture_movements WHERE lot_id=? AND sequence>? ORDER BY sequence LIMIT ?", (lot_id, after, limit + 1)).fetchall()
        page = rows[:limit]
        return {"lot_id": lot_id, "version": version, "movements": [{"sequence": r[0], **json.loads(r[1])} for r in page],
                "next_after": page[-1][0] if len(rows) > limit else None, **SCOPE}
