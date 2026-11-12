"""Opt-in synthetic intake quarantine; never real inventory or production approval."""
import json
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StrictInt, ValidationError, model_validator

from services.commerce.app.retail import Key, fingerprint, retail_enabled
from services.commerce.app.stock_ledger import (
    SCOPE, MAX_UNITS, Bucket, apply_leg, existing_lot, schema as ledger_schema,
)
from services.commerce.app.workflows import NOW, StrictModel, database, staff

router = APIRouter(prefix="/v1/admin/retail-test/component-ledger",
                   tags=["synthetic incoming inspection"],
                   dependencies=[Depends(retail_enabled), Depends(staff)])
Version = Annotated[StrictInt, Field(ge=0, le=9223372036854775806)]
Units = Annotated[StrictInt, Field(ge=0, le=MAX_UNITS)]
Defect = Literal["none", "chipped", "scratched", "incorrect_item", "other_fixture_defect"]


def schema(db):
    ledger_schema(db)
    db.execute("CREATE TABLE IF NOT EXISTS fixture_intakes (id TEXT PRIMARY KEY, document TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS fixture_intake_commands (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, document TEXT NOT NULL)")


def identity_exists(db, request_id):
    return (db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fixture_intake_commands'").fetchone()
            and db.execute("SELECT 1 FROM fixture_intake_commands WHERE request_id=?", (request_id,)).fetchone())


class Receipt(StrictModel):
    request_id: UUID
    expected_lot_version: Version
    lot_id: Key
    location_id: Key
    quantity: Annotated[StrictInt, Field(ge=1, le=MAX_UNITS)]


class Inspection(StrictModel):
    request_id: UUID
    expected_lot_version: Version
    accepted_units: Units
    rejected_units: Units
    defect: Defect

    @model_validator(mode="after")
    def consistent_partition(self):
        if self.accepted_units + self.rejected_units > MAX_UNITS:
            raise ValueError("Inspection quantity exceeds the supported limit.")
        if (self.rejected_units == 0) != (self.defect == "none"):
            raise ValueError("Use a defect code exactly when units are rejected.")
        return self


class IntakeRecord(StrictModel):
    id: Key
    lot_id: Key
    location_id: Key
    quantity: Annotated[StrictInt, Field(ge=1, le=MAX_UNITS)]
    state: Literal["pending", "inspected"]
    accepted_units: Units
    rejected_units: Units
    defect: Defect
    receipt_request_id: UUID
    inspection_request_id: UUID | None
    received_at: str
    inspected_at: str | None
    lot_version: Annotated[StrictInt, Field(ge=1, le=9223372036854775807)]
    actor: Literal["synthetic_staff"]
    actor_scope: Literal["shared staff test credential; not individual identity"]
    test_mode: Literal[True]
    checkout_authoritative: Literal[False]

    @model_validator(mode="after")
    def valid_state(self):
        if self.state == "pending":
            if (self.accepted_units or self.rejected_units or self.defect != "none"
                    or self.inspection_request_id is not None or self.inspected_at is not None):
                raise ValueError("Inconsistent pending intake.")
        elif (self.accepted_units + self.rejected_units != self.quantity
              or self.inspection_request_id is None or self.inspected_at is None
              or ((self.rejected_units == 0) != (self.defect == "none"))):
            raise ValueError("Inconsistent inspected intake.")
        return self


def decode(raw, intake_id):
    try:
        doc = IntakeRecord.model_validate_json(raw)
        if doc.id != intake_id:
            raise ValueError("Intake identity mismatch.")
        return doc.model_dump(mode="json")
    except (ValueError, ValidationError):
        raise HTTPException(409, "Synthetic intake needs reconciliation.") from None


def replay(db, intake_id, request_id, payload):
    from services.commerce.app.component_reservations import hold_identity_exists
    key = str(request_id)
    if (hold_identity_exists(db, key)
            or db.execute("SELECT 1 FROM fixture_movements WHERE request_id=?", (key,)).fetchone()):
        raise HTTPException(409, "Command identity belongs to another fixture operation.")
    digest = fingerprint(payload)
    row = db.execute("SELECT fingerprint,document FROM fixture_intake_commands WHERE request_id=?", (key,)).fetchone()
    if row:
        if row[0] != digest:
            raise HTTPException(409, "Intake command identity was reused with different contents.")
        return digest, decode(row[1], intake_id)
    return digest, None


def check_lot(db, lot_id, location_id, expected):
    _, version = existing_lot(db, lot_id)
    if type(version) is not int or not 0 <= version <= 9223372036854775806 or version != expected:
        raise HTTPException(409, "Synthetic lot version changed; review current intake and balances.")
    if not db.execute("SELECT 1 FROM fixture_locations WHERE id=?", (location_id,)).fetchone():
        raise HTTPException(409, "Create the synthetic location first.")
    return version


def save_command(db, request_id, digest, doc):
    db.execute("INSERT INTO fixture_intake_commands VALUES(?,?,?)",
               (str(request_id), digest, json.dumps(doc)))


@router.post("/intakes/{intake_id}", response_model=IntakeRecord)
def receive(intake_id: Key, body: Receipt):
    payload = {"operation": "receive", "intake_id": intake_id, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, intake_id, body.request_id, payload)
        if old is not None:
            return old
        if db.execute("SELECT 1 FROM fixture_intakes WHERE id=?", (intake_id,)).fetchone():
            raise HTTPException(409, "Synthetic intake already exists; inspect it or use a new identity.")
        version = check_lot(db, body.lot_id, body.location_id, body.expected_lot_version)
        doc = IntakeRecord(
            id=intake_id, lot_id=body.lot_id, location_id=body.location_id,
            quantity=body.quantity, state="pending", accepted_units=0, rejected_units=0,
            defect="none", receipt_request_id=body.request_id, inspection_request_id=None,
            received_at=NOW(), inspected_at=None, lot_version=version + 1,
            actor="synthetic_staff", actor_scope="shared staff test credential; not individual identity", **SCOPE
        ).model_dump(mode="json")
        # Quarantine is represented here, never in available balances.
        db.execute("INSERT INTO fixture_intakes VALUES(?,?)", (intake_id, json.dumps(doc)))
        db.execute("UPDATE fixture_lots SET version=version+1 WHERE id=?", (body.lot_id,))
        save_command(db, body.request_id, digest, doc)
        return doc


@router.post("/intakes/{intake_id}/inspection", response_model=IntakeRecord)
def inspect(intake_id: Key, body: Inspection):
    payload = {"operation": "inspect", "intake_id": intake_id, **body.model_dump(mode="json")}
    with database() as db:
        schema(db)
        digest, old = replay(db, intake_id, body.request_id, payload)
        if old is not None:
            return old
        row = db.execute("SELECT document FROM fixture_intakes WHERE id=?", (intake_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Synthetic intake not found.")
        doc = decode(row[0], intake_id)
        if doc["state"] != "pending":
            raise HTTPException(409, "Synthetic inspection is final; this intake cannot be inspected twice.")
        if body.accepted_units + body.rejected_units != doc["quantity"]:
            raise HTTPException(409, "Inspection must classify the entire intake quantity exactly.")
        version = check_lot(db, doc["lot_id"], doc["location_id"], body.expected_lot_version)
        if body.accepted_units:
            apply_leg(db, doc["lot_id"], Bucket(location_id=doc["location_id"], condition="available"),
                      body.accepted_units)
        # Rejected units remain excluded, not transferred to a recoverable available bucket.
        doc.update(state="inspected", accepted_units=body.accepted_units,
                   rejected_units=body.rejected_units, defect=body.defect,
                   inspection_request_id=str(body.request_id), inspected_at=NOW(), lot_version=version+1)
        db.execute("UPDATE fixture_intakes SET document=? WHERE id=?", (json.dumps(doc), intake_id))
        db.execute("UPDATE fixture_lots SET version=version+1 WHERE id=?", (doc["lot_id"],))
        save_command(db, body.request_id, digest, doc)
        return doc


@router.get("/intakes/{intake_id}", response_model=IntakeRecord)
def read_intake(intake_id: Key):
    with database() as db:
        # A read must not initialize intake tables.
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fixture_intakes'").fetchone():
            raise HTTPException(404, "Synthetic intake not found.")
        row = db.execute("SELECT document FROM fixture_intakes WHERE id=?", (intake_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Synthetic intake not found.")
        return decode(row[0], intake_id)
