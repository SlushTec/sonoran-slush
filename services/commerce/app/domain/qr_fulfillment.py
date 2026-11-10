"""Pure, disconnected QR mapping preflight; never authorizes production or orders.

All policy inputs must come from authenticated, owner-maintained records, not
request bodies. No confirmed supplier mappings are bundled. Prices from the
supplier are deliberately outside this contract.
"""
from __future__ import annotations

from hashlib import sha256
import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .prerequisites import ProductionPrerequisites

Text = Annotated[str, Field(min_length=1, max_length=250, pattern=r"\S")]


class Record(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)


class Option(Record):
    name: Text
    value: Text


class Choice(Record):
    """Exact product/variant selection; no aliases, case folding or size inference."""

    product_id: Text
    options: tuple[Option, ...] = ()

    @field_validator("options")
    @classmethod
    def canonical_options(cls, options):
        if len({o.name for o in options}) != len(options):
            raise ValueError("Duplicate option names are ambiguous")
        return tuple(sorted(options, key=lambda o: o.name))


class Mapping(Record):
    mapping_id: Text
    revision: Text
    local: Choice
    supplier: Choice
    equipment: Text
    process: Text
    state: Literal["unconfirmed", "confirmed", "withdrawn"] = "unconfirmed"
    evidence_ref: Text | None = None

    def fingerprint(self) -> str:
        """Bind owner qualification to every field, including the mapping revision."""
        encoded = json.dumps(self.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
        return sha256(encoded.encode("utf-8")).hexdigest()


class Qualification(Record):
    mapping_fingerprint: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    decision: Literal["compatible", "incompatible", "unknown"] = "unknown"
    owner_evidence_ref: Text | None = None
    # This explicit attestation is mandatory for every choice. Geometry/names
    # never imply it; curved work cannot pass even with a compatible decision.
    no_curved_jet_mini_confirmed: bool = False


class RetailApproval(Record):
    """Server-authoritative customer-approved unit price, never supplier pricing."""

    quote_id: Text
    current_version: Text
    accepted_version: Text | None = None
    local: Choice
    quantity: Annotated[int, Field(ge=1, le=500)]
    unit_price_minor: Annotated[int, Field(ge=0)]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class Request(Record):
    local: Choice
    quantity: Annotated[int, Field(ge=1, le=500)]


class Policy(Record):
    """Trusted exact local allowlist, separate from supplier mapping records.

    Includes only already-approved storefront choices. Supplying a mapping does
    not extend this allowlist. Duplicate/conflicting matches fail closed.
    """

    allowed_choices: tuple[Choice, ...] = ()
    mappings: tuple[Mapping, ...] = ()
    qualifications: tuple[Qualification, ...] = ()


class ReviewPlan(Record):
    mapping_id: Text
    mapping_revision: Text
    mapping_fingerprint: str
    supplier: Choice
    equipment: Text
    process: Text
    quantity: int
    customer_retail: RetailApproval


class Result(Record):
    status: Literal["unsupported", "ambiguous", "held", "ready_for_owner_review"]
    reasons: tuple[str, ...]
    plan: ReviewPlan | None = None
    execution_authorized: Literal[False] = False


def plan_fulfillment(
    request: Request,
    policy: Policy,
    retail: RetailApproval | None,
    prerequisites: ProductionPrerequisites,
) -> Result:
    """Deterministic preflight; no I/O, mutation, time, default selection or dispatch.

    A review plan is not release authority. Existing production prerequisites,
    authorization, proof/order binding and release gates remain independent.
    """
    if request.local not in policy.allowed_choices:
        return Result(status="unsupported", reasons=("LOCAL_CHOICE_NOT_APPROVED",))
    matches = tuple(m for m in policy.mappings if m.local == request.local)
    if not matches:
        return Result(status="held", reasons=("MAPPING_MISSING",))
    if len(matches) != 1:
        return Result(status="ambiguous", reasons=("MULTIPLE_EXACT_MAPPINGS",))
    mapping = matches[0]
    if sum(m.mapping_id == mapping.mapping_id for m in policy.mappings) != 1:
        return Result(status="ambiguous", reasons=("DUPLICATE_MAPPING_ID",))
    reasons = []
    if mapping.state != "confirmed" or not mapping.evidence_ref:
        reasons.append("MAPPING_NOT_CONFIRMED")
    fingerprint = mapping.fingerprint()
    qualifications = tuple(q for q in policy.qualifications if q.mapping_fingerprint == fingerprint)
    if len(qualifications) > 1:
        return Result(status="ambiguous", reasons=("MULTIPLE_OWNER_QUALIFICATIONS",))
    if not qualifications:
        reasons.append("OWNER_QUALIFICATION_MISSING")
    else:
        qualification = qualifications[0]
        if qualification.decision == "incompatible":
            reasons.append("OWNER_INCOMPATIBLE")
        elif qualification.decision != "compatible" or not qualification.owner_evidence_ref:
            reasons.append("OWNER_QUALIFICATION_UNCONFIRMED")
        if not qualification.no_curved_jet_mini_confirmed:
            reasons.append("NO_CURVED_JET_MINI_NOT_CONFIRMED")
    if retail is None:
        reasons.append("CUSTOMER_RETAIL_APPROVAL_MISSING")
    else:
        if retail.accepted_version != retail.current_version:
            reasons.append("CUSTOMER_RETAIL_VERSION_NOT_ACCEPTED")
        if retail.local != request.local or retail.quantity != request.quantity:
            reasons.append("CUSTOMER_RETAIL_SELECTION_MISMATCH")
    if not prerequisites.releasable():
        reasons.append("PRODUCTION_PREREQUISITES_UNSATISFIED")
    if reasons:
        return Result(status="held", reasons=tuple(reasons))
    return Result(
        status="ready_for_owner_review",
        reasons=(),
        plan=ReviewPlan(
            mapping_id=mapping.mapping_id,
            mapping_revision=mapping.revision,
            mapping_fingerprint=fingerprint,
            supplier=mapping.supplier,
            equipment=mapping.equipment,
            process=mapping.process,
            quantity=request.quantity,
            customer_retail=retail,
        ),
    )
