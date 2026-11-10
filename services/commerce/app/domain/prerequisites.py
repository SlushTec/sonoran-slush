"""A tested invariant, not a payment processor or production implementation."""
from pydantic import BaseModel, ConfigDict

class ProductionPrerequisites(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)
    payment_rule_satisfied: bool
    inventory_reserved: bool
    capacity_confirmed: bool
    proof_required: bool
    current_proof_version: str | None = None
    approved_proof_version: str | None = None

    def releasable(self) -> bool:
        proof_ok = not self.proof_required or (
            bool(self.current_proof_version)
            and self.current_proof_version == self.approved_proof_version
        )
        return bool(self.payment_rule_satisfied and self.inventory_reserved and self.capacity_confirmed and proof_ok)
