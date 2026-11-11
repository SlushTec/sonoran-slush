"""Typed persisted-fixture boundaries, separate from business mutation logic."""
import json
from typing import Annotated, Any, Literal

from fastapi import HTTPException
from pydantic import AwareDatetime, Field, StrictBool, StrictInt, ValidationError, field_validator, model_validator

from services.commerce.app.retail import Key
from services.commerce.app.workflows import StrictModel

SCOPE = {"test_mode": True, "owner_approved": False, "production_approved": False}
UNQUALIFIED = ["options", "tax", "machine_profiles", "owner_identity", "production"]


def invalid(kind):
    return HTTPException(409, f"Fixture {kind} needs reconciliation.")


def parse_document(value, kind):
    if not isinstance(value, str):
        raise invalid(kind)
    try:
        result = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        raise invalid(kind) from None
    if not isinstance(result, dict):
        raise invalid(kind)
    return result


class FixtureScope(StrictModel):
    test_mode: StrictBool
    owner_approved: StrictBool
    production_approved: StrictBool

    @model_validator(mode="after")
    def no_live_authority(self):
        if not self.test_mode or self.owner_approved or self.production_approved:
            raise ValueError("Only non-owner-approved test fixture data is supported.")
        return self


class FixtureAudit(StrictModel):
    action: Literal["draft_created", "approve_test", "retire_test", "test_set_created", "publish_test", "rollback_test"]
    reason: str = Field(min_length=1, max_length=200)
    recorded_at: AwareDatetime
    actor: Literal["synthetic_staff"]
    actor_scope: Literal["shared staff test credential; not an owner or individual reviewer"]

    @field_validator("recorded_at", mode="before")
    @classmethod
    def textual_timestamp(cls, value):
        if not isinstance(value, str):
            raise ValueError("A persisted ISO timestamp string is required.")
        return value

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value):
        if not value.strip() or any(ord(x) < 32 or ord(x) == 127 for x in value):
            raise ValueError("A single-line audit reason is required.")
        return value


class StoredSnapshot(FixtureScope):
    id: Key
    revision: StrictInt = Field(ge=1, le=1000000)
    kind: Literal["catalog", "prices", "policies"]
    source_reference: Key
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=100)
    audit: list[FixtureAudit] = Field(min_length=1, max_length=3)
    status: Literal["draft", "approved_test", "retired_test"] | None = None
    lifecycle_version: Annotated[StrictInt, Field(ge=1, le=1000000)] | None = None


def checked_snapshot(document, snapshot_id, revision, kind, status, lifecycle_version):
    from services.commerce.app.commercial_snapshots import CatalogRow, PriceRow, PolicyRow
    try:
        model = StoredSnapshot.model_validate(document)
        row_type = {"catalog": CatalogRow, "prices": PriceRow, "policies": PolicyRow}[model.kind]
        rows = [row_type.model_validate(row) for row in model.rows]
    except ValidationError:
        raise invalid("snapshot content") from None
    if (model.id != snapshot_id or model.revision != revision or model.kind != kind
            or ("status" in document and model.status != status)
            or ("lifecycle_version" in document and model.lifecycle_version != lifecycle_version)):
        raise invalid("snapshot identity")
    if model.kind == "catalog":
        keys = [row.product_slug for row in rows]
    elif model.kind == "prices":
        keys = [(row.product_slug, row.variant_key) for row in rows]
    else:
        keys = [row.policy_key for row in rows]
    if len(set(keys)) != len(keys):
        raise invalid("snapshot rows")
    actions = [item.action for item in model.audit]
    allowed = {
        "draft": [["draft_created"]],
        "approved_test": [["draft_created", "approve_test"]],
        "retired_test": [["draft_created", "retire_test"], ["draft_created", "approve_test", "retire_test"]],
    }
    if status not in allowed or actions not in allowed[status] or lifecycle_version != len(actions):
        raise invalid("snapshot lifecycle")
    return {**document, "status": status, "lifecycle_version": lifecycle_version, **SCOPE}


class StoredRef(StrictModel):
    snapshot_id: Key
    revision: StrictInt = Field(ge=1, le=1000000)


class StoredReferences(StrictModel):
    catalog: StoredRef
    prices: StoredRef
    policies: StoredRef


class StoredManifest(FixtureScope):
    id: Key
    references: StoredReferences
    content_hashes: dict[str, Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]] = Field(min_length=3, max_length=3)
    audit: list[FixtureAudit] = Field(min_length=1, max_length=1)
    unqualified_domains: list[str] = Field(min_length=5, max_length=5)


def checked_manifest(document, set_id):
    try:
        model = StoredManifest.model_validate(document)
    except ValidationError:
        raise invalid("set content") from None
    if (model.id != set_id or set(model.content_hashes) != {"catalog", "prices", "policies"}
            or model.unqualified_domains != UNQUALIFIED or model.audit[0].action != "test_set_created"):
        raise invalid("set identity or provenance")
    return {**document, **SCOPE}


class StoredPointer(FixtureScope):
    set_id: Key
    pointer_version: StrictInt = Field(ge=1, le=1000000)
    audit: FixtureAudit


def checked_pointer(document, version=None, set_id=None):
    try:
        model = StoredPointer.model_validate(document)
    except ValidationError:
        raise invalid("pointer content") from None
    if ((version is not None and model.pointer_version != version)
            or (set_id is not None and model.set_id != set_id)
            or model.audit.action not in ("publish_test", "rollback_test")):
        raise invalid("pointer identity")
    return {**document, **SCOPE}


def checked_receipt(document, payload):
    operation = payload["operation"]
    if operation in ("create_snapshot", "review_snapshot"):
        return checked_snapshot(document, payload["id"], payload["revision"], document.get("kind"),
                                document.get("status"), document.get("lifecycle_version"))
    if operation == "create_set":
        return checked_manifest(document, payload["id"])
    if operation == "select_set":
        return checked_pointer(document, set_id=payload["set_id"])
    raise invalid("command operation")
