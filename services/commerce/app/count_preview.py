"""Read-only synthetic bucket comparison; never a stock correction or permission."""
import sqlite3
import os
import secrets
from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, StrictBool, StrictInt, model_validator

from services.commerce.app.retail import Key, retail_enabled
from services.commerce.app.workflows import ROOT, StrictModel, staff
from services.commerce.app.stock_ledger import (
    Condition, Location, MAX_UNITS, availability_definition, availability_view,
)

router = APIRouter(prefix="/v1/admin/retail-test/component-ledger",
                   tags=["synthetic count preview"],
                   dependencies=[Depends(retail_enabled), Depends(staff)])
Units = Annotated[StrictInt, Field(ge=0, le=MAX_UNITS)]
Version = Annotated[StrictInt, Field(ge=0, le=9223372036854775806)]


class CountObservation(StrictModel):
    location_id: Key
    condition: Condition
    observed_units: Units


class CountRequest(StrictModel):
    expected_version: Version
    observations: list[CountObservation] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_buckets(self):
        keys = [(item.location_id, item.condition) for item in self.observations]
        if len(keys) != len(set(keys)):
            raise ValueError("Supply each explicit location and condition once.")
        return self


class CountDifference(CountObservation):
    recorded_units: Units
    variance_units: Annotated[StrictInt, Field(ge=-MAX_UNITS, le=MAX_UNITS)]
    protected_reserved_units: Units
    reservation_floor_conflict: StrictBool


class CountPreview(StrictModel):
    lot_id: Key
    component_id: Key
    unit: Literal["piece", "millilitre", "gram", "millimetre"]
    version: Version
    observations: list[CountDifference] = Field(min_length=1, max_length=100)
    scope: Literal["explicit_buckets_only"] = "explicit_buckets_only"
    applied: Literal[False] = False
    correction_authorized: Literal[False] = False
    test_mode: Literal[True] = True
    checkout_authoritative: Literal[False] = False


@contextmanager
def count_database():
    # Unlike the writer context, this must never initialize a missing database.
    path = Path(os.environ.get("SONORAN_DB_PATH") or str(ROOT / ".state" / "commerce.sqlite3")).resolve()
    if not path.is_file():
        raise HTTPException(404, "Synthetic lot not found.")
    db = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=15, isolation_level=None)
    try:
        db.execute("BEGIN")
        row = db.execute("SELECT value FROM metadata WHERE key='access_secret_fingerprint'").fetchone()
        expected = sha256(os.environ["SONORAN_ACCESS_SECRET"].encode()).hexdigest()
        if row is None or type(row[0]) is not str:
            raise ValueError("Missing fixture access binding.")
        if not secrets.compare_digest(row[0], expected):
            raise HTTPException(503, "The record service needs its existing access configuration restored.")
        yield db
    finally:
        db.close()


@router.post("/lots/{lot_id}/count-preview", response_model=CountPreview)
def count_preview(lot_id: Key, body: CountRequest):
    try:
        with count_database() as db:
            current = availability_view(db, lot_id, body.expected_version)
            locations = {item.location_id: item for item in current.locations}
            result = []
            for observed in body.observations:
                # A known but unused location can legitimately have a zero balance.
                # Unknown or corrupt definitions must never silently become zero.
                availability_definition(db, "fixture_locations", observed.location_id, Location)
                location = locations.get(observed.location_id)
                recorded = getattr(location.condition_units, observed.condition) if location else 0
                reserved = location.reserved_units if location and observed.condition == "available" else 0
                result.append(CountDifference(
                    **observed.model_dump(), recorded_units=recorded,
                    variance_units=observed.observed_units - recorded,
                    protected_reserved_units=reserved,
                    reservation_floor_conflict=observed.observed_units < reserved,
                ))
            return CountPreview(lot_id=lot_id, component_id=current.component_id,
                                unit=current.unit, version=current.version, observations=result)
    except (ValueError, KeyError, TypeError, RecursionError, sqlite3.DatabaseError):
        raise HTTPException(409, "Synthetic count preview needs reconciliation.") from None
