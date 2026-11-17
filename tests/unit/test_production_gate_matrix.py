"""Synthetic truth-table qualification of the existing gate, not a release authorization."""
from itertools import product

import pytest
from pydantic import ValidationError

from services.commerce.app.domain.prerequisites import ProductionPrerequisites

BOOLEAN_FIELDS = (
    "payment_rule_satisfied",
    "inventory_reserved",
    "capacity_confirmed",
    "proof_required",
)
PROOF_RELATIONS = (
    (None, None),
    ("proof-1", None),
    (None, "proof-1"),
    ("", ""),
    ("proof-1", "proof-1"),
    ("proof-1", "proof-2"),
    ("proof-1", ""),
)


@pytest.mark.parametrize("flags", list(product((False, True), repeat=4)))
@pytest.mark.parametrize("current,approved", PROOF_RELATIONS)
def test_all_commercial_gates_and_exact_proof_relation(flags, current, approved):
    values = dict(zip(BOOLEAN_FIELDS, flags))
    values.update(current_proof_version=current, approved_proof_version=approved)
    gate = ProductionPrerequisites(**values)
    before = gate.model_dump()
    commercial_ready = flags[:3] == (True, True, True)
    proof_ready = not flags[3] or (current, approved) == ("proof-1", "proof-1")
    assert gate.releasable() is (commercial_ready and proof_ready)
    assert gate.model_dump() == before


@pytest.mark.parametrize("field", BOOLEAN_FIELDS)
@pytest.mark.parametrize("value", ["true", "false", 0, 1, None, [], {}])
def test_each_gate_rejects_non_boolean_coercion(field, value):
    values = dict.fromkeys(BOOLEAN_FIELDS, True)
    values.update(current_proof_version="proof-1", approved_proof_version="proof-1")
    values[field] = value
    with pytest.raises(ValidationError):
        ProductionPrerequisites(**values)


def test_gate_snapshot_cannot_be_changed_after_validation():
    gate = ProductionPrerequisites(**dict.fromkeys(BOOLEAN_FIELDS, False))
    for field in BOOLEAN_FIELDS:
        with pytest.raises(ValidationError):
            setattr(gate, field, True)
    assert not gate.releasable()


def test_unknown_override_cannot_bypass_missing_prerequisites():
    with pytest.raises(ValidationError):
        ProductionPrerequisites(**dict.fromkeys(BOOLEAN_FIELDS, False), force_release=True)
