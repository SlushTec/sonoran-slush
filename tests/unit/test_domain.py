import pytest
from pydantic import ValidationError
from services.commerce.app.domain.prerequisites import ProductionPrerequisites

def gate(**changes):
    values = dict(payment_rule_satisfied=True, inventory_reserved=True, capacity_confirmed=True, proof_required=True, current_proof_version="proof-2", approved_proof_version="proof-2")
    values.update(changes)
    return ProductionPrerequisites(**values)

def test_exact_approved_version_and_other_prerequisites_allow_release():
    assert gate().releasable()

@pytest.mark.parametrize("field", ["payment_rule_satisfied", "inventory_reserved", "capacity_confirmed"])
def test_missing_prerequisites_block_release(field):
    assert not gate(**{field:False}).releasable()

def test_old_proof_approval_does_not_approve_revision():
    assert not gate(approved_proof_version="proof-1").releasable()

def test_missing_proof_blocks_when_required():
    assert not gate(current_proof_version=None, approved_proof_version=None).releasable()

def test_no_proof_required_still_needs_commercial_prerequisites():
    assert gate(proof_required=False, current_proof_version=None, approved_proof_version=None).releasable()
    assert not gate(proof_required=False, payment_rule_satisfied=False).releasable()

def test_no_truthy_string_bypass():
    with pytest.raises(ValidationError):
        gate(payment_rule_satisfied="false")
