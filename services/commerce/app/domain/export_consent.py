"""Disconnected transfer-consent preflight, not authentication or transfer authority.

All records and the clock must be server-resolved, current trusted inputs.
No API, storage, upload, network, recipient defaults, or retention policy is added.
"""
from datetime import datetime
from typing import Annotated, Literal
import unicodedata
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=200)]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class Record(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)

    @field_validator("*")
    @classmethod
    def safe_text(cls, value):
        if isinstance(value, str) and (
            not value.strip() or any(unicodedata.category(c) in {"Cc", "Cs"} for c in value)
        ):
            raise ValueError("Invalid record text")
        return value


class ExportBinding(Record):
    order_id: Identifier
    asset_id: Identifier
    export_sha256: Digest
    proof_id: Identifier
    proof_version: Annotated[int, Field(ge=1)]
    configuration_sha256: Digest


class TransferRequest(Record):
    binding: ExportBinding
    recipient_id: Identifier
    purpose: Literal["supplier_conversion", "supplier_manufacture"]
    policy_version: Identifier


class Consent(Record):
    consent_id: Identifier
    subject_id: Identifier
    request: TransferRequest
    reproduction_permitted: bool
    transfer_permitted: bool
    state: Literal["active", "withdrawn"]
    granted_at: AwareDatetime
    expires_at: AwareDatetime

    @model_validator(mode="after")
    def ordered_interval(self):
        if self.expires_at <= self.granted_at:
            raise ValueError("Consent interval must be positive")
        return self


class Review(Record):
    status: Literal["held", "ready_for_owner_review"]
    reasons: tuple[str, ...]
    transfer_authorized: Literal[False] = False


def review_export_consent(
    request: TransferRequest,
    current_binding: ExportBinding,
    expected_subject_id: str,
    consent: Consent | None,
    now: datetime,
) -> Review:
    """Evaluate exact consent scope only, without mutating or exporting records.

    Even a ready result requires current server identity/ownership, exact proof,
    payment, inventory, capacity, supplier mapping/spend and dispatch controls.
    Consent must be re-resolved at actual dispatch; this result is not a token.
    """
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Explicit aware clock required")
    if not isinstance(expected_subject_id, str) or not expected_subject_id.strip():
        raise ValueError("Authenticated subject reference required")
    reasons = []
    if request.binding != current_binding:
        reasons.append("CURRENT_EXPORT_MISMATCH")
    if consent is None:
        reasons.append("CONSENT_MISSING")
    else:
        if consent.subject_id != expected_subject_id:
            reasons.append("CONSENT_SUBJECT_MISMATCH")
        if consent.request != request:
            reasons.append("CONSENT_SCOPE_MISMATCH")
        if consent.state != "active":
            reasons.append("CONSENT_WITHDRAWN")
        if not consent.reproduction_permitted or not consent.transfer_permitted:
            reasons.append("PERMISSION_MISSING")
        if not consent.granted_at <= now < consent.expires_at:
            reasons.append("CONSENT_NOT_CURRENT")
    return Review(status="held" if reasons else "ready_for_owner_review", reasons=tuple(reasons))
