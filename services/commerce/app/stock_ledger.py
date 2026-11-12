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
    from services.commerce.app.component_reservations import reserved_units
    units = balance(db, lot_id, bucket) + delta
    floor = reserved_units(db, lot_id, bucket.location_id) if bucket.condition == "available" else 0
    if units < floor:
        raise HTTPException(409, "Active fixture reservations protect these components.")
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
        from services.commerce.app.component_reservations import hold_identity_exists
        from services.commerce.app.incoming_inspection import identity_exists
        if identity_exists(db, str(body.request_id)):
            raise HTTPException(409, "Command identity already belongs to an intake operation.")
        if hold_identity_exists(db, str(body.request_id)):
            raise HTTPException(409, "Command identity already belongs to a fixture reservation.")
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


# This deliberately bounded read model does not initialize or repair fixture tables.
AVAILABILITY_CONDITIONS = ("available", "damaged", "sample", "in_production", "completed", "shipped")
AVAILABILITY_SCAN_LIMIT = 1000
AvailabilityUnits = Annotated[StrictInt, Field(ge=0, le=MAX_UNITS)]


class ConditionUnits(StrictModel):
    available: AvailabilityUnits
    damaged: AvailabilityUnits
    sample: AvailabilityUnits
    in_production: AvailabilityUnits
    completed: AvailabilityUnits
    shipped: AvailabilityUnits


class LocationAvailability(StrictModel):
    location_id: Key
    condition_units: ConditionUnits
    reserved_units: AvailabilityUnits
    free_units: AvailabilityUnits


class LotAvailability(StrictModel):
    lot_id: Key
    component_id: Key
    unit: Literal["piece", "millilitre", "gram", "millimetre"]
    version: Annotated[StrictInt, Field(ge=0, le=9223372036854775806)]
    locations: list[LocationAvailability] = Field(max_length=100)
    test_mode: Literal[True]
    checkout_authoritative: Literal[False]


def availability_key(value):
    # fullmatch avoids accepting a final newline in a stored source identity.
    import re
    if type(value) is not str or not 1 <= len(value) <= 100 or re.fullmatch(r"[a-zA-Z0-9_-]+", value) is None:
        raise ValueError("Invalid fixture identity.")
    return value


def availability_integer(value, low=0, high=MAX_UNITS):
    if type(value) is not int or not low <= value <= high:
        raise ValueError("Invalid fixture quantity or version.")
    return value


def availability_document(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate fixture member.")
            result[key] = value
        return result

    def invalid_constant(_):
        raise ValueError("Nonfinite fixture number.")

    if type(raw) is not str or len(raw) > 262144:
        raise ValueError("Unsupported fixture document.")
    doc = json.loads(raw, object_pairs_hook=unique, parse_constant=invalid_constant)
    if type(doc) is not dict or doc.get("test_mode") is not True or doc.get("checkout_authoritative") is not False:
        raise ValueError("Invalid fixture scope.")
    return doc


def availability_definition(db, table, key, model):
    availability_key(key)
    row = db.execute(f"SELECT document FROM {table} WHERE id=?", (key,)).fetchone()
    if row is None:
        raise ValueError("Missing fixture definition.")
    doc = availability_document(row[0])
    if doc.get("id") != key:
        raise ValueError("Fixture definition identity mismatch.")
    # Unknown stored metadata is not copied into the read model.
    model.model_validate({field: doc[field] for field in model.model_fields}, strict=True)
    return doc


def availability_view(db, lot_id, expected_version=None):
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    ledger = {"fixture_components", "fixture_locations", "fixture_lots", "fixture_balances", "fixture_movements"}
    holds_namespace = {"fixture_boms", "fixture_holds", "fixture_allocations", "fixture_hold_commands", "fixture_hold_events"}
    if not tables & ledger:
        if tables & holds_namespace:
            raise ValueError("Incomplete fixture namespace.")
        raise HTTPException(404, "Synthetic lot not found.")
    if not ledger <= tables or (tables & holds_namespace and not holds_namespace <= tables):
        raise ValueError("Incomplete fixture namespace.")
    row = db.execute("SELECT version FROM fixture_lots WHERE id=?", (lot_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Synthetic lot not found.")
    version = availability_integer(row[0], 0, 9223372036854775806)
    if expected_version is not None and expected_version != version:
        raise ValueError("Stale fixture read.")

    lot_cache, location_cache = {}, set()

    def known_lot(key):
        if key not in lot_cache:
            doc = availability_definition(db, "fixture_lots", key, Lot)
            component = availability_definition(db, "fixture_components", doc["component_id"], Component)
            lot_cache[key] = (doc["component_id"], component["unit"])
        return lot_cache[key]

    def known_location(key):
        if key not in location_cache:
            availability_definition(db, "fixture_locations", key, Location)
            location_cache.add(key)

    component_id, unit = known_lot(lot_id)
    balances = db.execute("SELECT location_id,condition,units FROM fixture_balances WHERE lot_id=? ORDER BY location_id,condition LIMIT 601", (lot_id,)).fetchall()
    if len(balances) > 600:
        raise ValueError("Fixture balance read limit exceeded.")
    by_location = {}

    def location_units(key):
        known_location(key)
        if key not in by_location:
            if len(by_location) == 100:
                raise ValueError("Fixture location read limit exceeded.")
            by_location[key] = {condition: 0 for condition in AVAILABILITY_CONDITIONS}
        return by_location[key]

    for location_id, condition, units in balances:
        if condition not in AVAILABILITY_CONDITIONS:
            raise ValueError("Unknown fixture condition.")
        location_units(location_id)[condition] = availability_integer(units)

    reserved = {}
    if holds_namespace <= tables:
        target_rows = db.execute("SELECT hold_id,lot_id,location_id,units,state FROM fixture_allocations WHERE lot_id=? ORDER BY hold_id,location_id LIMIT ?", (lot_id, AVAILABILITY_SCAN_LIMIT + 1)).fetchall()
        hold_rows = db.execute("SELECT id,document FROM fixture_holds ORDER BY id LIMIT ?", (AVAILABILITY_SCAN_LIMIT + 1,)).fetchall()
        if len(target_rows) > AVAILABILITY_SCAN_LIMIT or len(hold_rows) > AVAILABILITY_SCAN_LIMIT:
            raise ValueError("Fixture reservation read limit exceeded.")
        target_hold_ids = set()
        for hold_id, source_lot, location_id, units, state in target_rows:
            availability_key(hold_id)
            if source_lot != lot_id or state not in ("active", "released", "consumed"):
                raise ValueError("Invalid fixture allocation row.")
            availability_integer(units, 1)
            known_location(location_id)
            target_hold_ids.add(hold_id)
            if state == "active":
                location_units(location_id)
        seen_target_holds = set()
        for hold_id, raw in hold_rows:
            availability_key(hold_id)
            doc = availability_document(raw)
            allocations = doc.get("allocations")
            if doc.get("id") != hold_id or doc.get("state") not in ("active", "released", "consumed"):
                raise ValueError("Invalid fixture hold identity or state.")
            availability_integer(doc.get("version"), 1, 9223372036854775806)
            if type(allocations) is not list or not 1 <= len(allocations) <= 100:
                raise ValueError("Invalid fixture hold allocation list.")
            expected, keys = [], set()
            for a in allocations:
                if type(a) is not dict:
                    raise ValueError("Invalid fixture allocation.")
                for key in ("lot_id", "location_id", "component_id", "unit"):
                    availability_key(a.get(key))
                availability_integer(a.get("units"), 1)
                key = (a["lot_id"], a["location_id"])
                if key in keys:
                    raise ValueError("Repeated fixture allocation.")
                keys.add(key)
                expected.append((a["lot_id"], a["location_id"], a["units"], doc["state"]))
            relevant = hold_id in target_hold_ids or any(a["lot_id"] == lot_id for a in allocations)
            if not relevant:
                continue
            seen_target_holds.add(hold_id)
            for a in allocations:
                if known_lot(a["lot_id"]) != (a["component_id"], a["unit"]):
                    raise ValueError("Fixture component or unit mismatch.")
                known_location(a["location_id"])
                if a["lot_id"] == lot_id and doc["state"] == "active":
                    location_units(a["location_id"])
            actual = db.execute("SELECT lot_id,location_id,units,state FROM fixture_allocations WHERE hold_id=? ORDER BY lot_id,location_id LIMIT 101", (hold_id,)).fetchall()
            if len(actual) > 100:
                raise ValueError("Fixture hold allocation read limit exceeded.")
            # Validate raw types before tuple equality (True must not equal one unit).
            for source_lot, location_id, units, state in actual:
                availability_key(source_lot)
                availability_key(location_id)
                availability_integer(units, 1)
                if state not in ("active", "released", "consumed"):
                    raise ValueError("Invalid fixture allocation state.")
            if sorted(expected) != actual:
                raise ValueError("Incomplete fixture hold/allocation relationship.")
            if doc["state"] == "active":
                for a in allocations:
                    if a["lot_id"] == lot_id:
                        key = a["location_id"]
                        reserved[key] = reserved.get(key, 0) + a["units"]
        if not target_hold_ids <= seen_target_holds:
            raise ValueError("Orphan fixture allocations.")

    locations = []
    for location_id, condition_units in sorted(by_location.items()):
        held = reserved.get(location_id, 0)
        free = condition_units["available"] - held
        availability_integer(free)  # Negative free is corruption, not zero availability.
        availability_integer(held)
        locations.append({"location_id": location_id, "condition_units": condition_units,
                          "reserved_units": held, "free_units": free})
    return LotAvailability.model_validate({"lot_id": lot_id, "component_id": component_id,
        "unit": unit, "version": version, "locations": locations, **SCOPE}, strict=True)


@router.get("/lots/{lot_id}/availability", response_model=LotAvailability)
def lot_availability(lot_id: Key, expected_version: Annotated[int | None, Query(ge=0, le=9223372036854775806)] = None):
    import sqlite3
    try:
        with database() as db:
            return availability_view(db, lot_id, expected_version)
    except (ValueError, KeyError, TypeError, RecursionError, sqlite3.DatabaseError):
        raise HTTPException(409, "Synthetic lot availability needs reconciliation.") from None
