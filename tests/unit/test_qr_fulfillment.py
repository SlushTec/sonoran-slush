"""Synthetic exact choices only; these are not approved supplier/product data."""
import pytest
from pydantic import ValidationError

from services.commerce.app.domain.prerequisites import ProductionPrerequisites
from services.commerce.app.domain.qr_fulfillment import (
    Choice, Mapping, Option, Policy, Qualification, Request, RetailApproval,
    plan_fulfillment,
)


def replace(record, **changes):
    # Revalidate; model_copy(update=...) intentionally bypasses Pydantic checks.
    return type(record).model_validate({**record.model_dump(), **changes})


def fixture():
    local = Choice(product_id="fixture-local", options=(Option(name="Size", value="fixture-small"),))
    supplier = Choice(product_id="fixture-supplier", options=(Option(name="variant", value="fixture-1"),))
    mapping = Mapping(mapping_id="fixture-map", revision="1", local=local, supplier=supplier,
                      equipment="Jet Mini", process="fixture-process", state="confirmed",
                      evidence_ref="fixture-only:mapping")
    qualification = Qualification(mapping_fingerprint=mapping.fingerprint(), decision="compatible",
                                  owner_evidence_ref="fixture-only:owner",
                                  no_curved_jet_mini_confirmed=True)
    policy = Policy(allowed_choices=(local,), mappings=(mapping,), qualifications=(qualification,))
    retail = RetailApproval(quote_id="fixture-quote", current_version="2", accepted_version="2",
                            local=local, quantity=2, unit_price_minor=12345, currency="USD")
    gate = ProductionPrerequisites(payment_rule_satisfied=True, inventory_reserved=True,
                                  capacity_confirmed=True, proof_required=True,
                                  current_proof_version="2", approved_proof_version="2")
    return Request(local=local, quantity=2), policy, retail, gate


def test_exact_qualified_choice_preserves_customer_price_but_never_authorizes_execution():
    args = fixture()
    before = [a.model_dump_json() for a in args]
    result = plan_fulfillment(*args)
    assert result.status == "ready_for_owner_review"
    assert result.plan.customer_retail == args[2]
    assert result.plan.customer_retail.unit_price_minor == 12345
    assert result.execution_authorized is False
    assert result == plan_fulfillment(*args)
    assert before == [a.model_dump_json() for a in args]


@pytest.mark.parametrize("options", [(), (Option(name="Size", value="fixture-large"),),
    (Option(name="Size", value="FIXTURE-SMALL"),),
    (Option(name="Size", value="fixture-small"), Option(name="Extra", value="yes"))])
def test_missing_extra_case_changed_and_expanded_options_are_unsupported(options):
    request, policy, retail, gate = fixture()
    changed = replace(request, local=replace(request.local, options=options))
    # Even a supplier mapping must not expand the approved local choice allowlist.
    policy = replace(policy, mappings=(replace(policy.mappings[0], local=changed.local),))
    result = plan_fulfillment(changed, policy, retail, gate)
    assert result.status == "unsupported" and result.plan is None


def test_empty_registry_holds_approved_choice():
    request, policy, retail, gate = fixture()
    assert plan_fulfillment(request, Policy(), retail, gate).status == "unsupported"
    result = plan_fulfillment(request, replace(policy, mappings=()), retail, gate)
    assert result.reasons == ("MAPPING_MISSING",)


@pytest.mark.parametrize("field,value", [("state", "unconfirmed"), ("state", "withdrawn"),
    ("revision", "2"), ("process", "different"), ("equipment", "different"),
    ("supplier", Choice(product_id="different")), ("evidence_ref", None)])
def test_mapping_change_invalidates_exact_owner_qualification(field, value):
    request, policy, retail, gate = fixture()
    policy = replace(policy, mappings=(replace(policy.mappings[0], **{field: value}),))
    result = plan_fulfillment(request, policy, retail, gate)
    assert result.status == "held" and result.plan is None
    assert "OWNER_QUALIFICATION_MISSING" in result.reasons


@pytest.mark.parametrize("change,reason", [
    ({"decision": "unknown"}, "OWNER_QUALIFICATION_UNCONFIRMED"),
    ({"decision": "incompatible"}, "OWNER_INCOMPATIBLE"),
    ({"owner_evidence_ref": None}, "OWNER_QUALIFICATION_UNCONFIRMED"),
    ({"no_curved_jet_mini_confirmed": False}, "NO_CURVED_JET_MINI_NOT_CONFIRMED"),
])
def test_owner_evidence_and_no_curved_attestation_required(change, reason):
    request, policy, retail, gate = fixture()
    policy = replace(policy, qualifications=(replace(policy.qualifications[0], **change),))
    result = plan_fulfillment(request, policy, retail, gate)
    assert reason in result.reasons and result.plan is None


@pytest.mark.parametrize("field", ["mappings", "qualifications"])
def test_duplicates_never_choose_first(field):
    request, policy, retail, gate = fixture()
    policy = replace(policy, **{field: getattr(policy, field) * 2})
    result = plan_fulfillment(request, policy, retail, gate)
    assert result.status == "ambiguous" and result.plan is None


def test_reused_mapping_id_is_ambiguous_even_for_different_local_choice():
    request, policy, retail, gate = fixture()
    policy = replace(policy, mappings=(*policy.mappings,
        replace(policy.mappings[0], local=Choice(product_id="other"))))
    assert plan_fulfillment(request, policy, retail, gate).reasons == ("DUPLICATE_MAPPING_ID",)


@pytest.mark.parametrize("change", [{"accepted_version": None}, {"accepted_version": "1"},
    {"quantity": 1}, {"local": Choice(product_id="other")}])
def test_retail_acceptance_is_bound_to_exact_version_selection_and_quantity(change):
    request, policy, retail, gate = fixture()
    result = plan_fulfillment(request, policy, replace(retail, **change), gate)
    assert result.status == "held" and result.plan is None


def test_missing_customer_price_never_falls_back_to_supplier_price():
    request, policy, _, gate = fixture()
    assert plan_fulfillment(request, policy, None, gate).reasons == ("CUSTOMER_RETAIL_APPROVAL_MISSING",)
    with pytest.raises(ValidationError):
        replace(policy.mappings[0], supplier_price_minor=100)


@pytest.mark.parametrize("change", [{"payment_rule_satisfied": False}, {"inventory_reserved": False},
    {"capacity_confirmed": False}, {"approved_proof_version": "1"}, {"current_proof_version": None}])
def test_existing_independent_production_gates_still_hold(change):
    request, policy, retail, gate = fixture()
    result = plan_fulfillment(request, policy, retail, replace(gate, **change))
    assert result.reasons == ("PRODUCTION_PREREQUISITES_UNSATISFIED",)
    assert result.plan is None and not result.execution_authorized


def test_option_order_is_canonical_without_aliasing_values():
    a, b = Option(name="Size", value="small"), Option(name="Orientation", value="portrait")
    assert Choice(product_id="fixture", options=(a, b)) == Choice(product_id="fixture", options=(b, a))
    with pytest.raises(ValidationError):
        Choice(product_id="fixture", options=(a, a))


@pytest.mark.parametrize("change", [{"quantity": True}, {"quantity": "2"}, {"quantity": 0},
    {"quantity": 501}, {"quantity": 1.5}, {"unit_price_minor": -1},
    {"unit_price_minor": True}, {"unit_price_minor": 1.2}, {"currency": "usd"},
    {"supplier_cost_minor": 1}, {"quote_id": " "}])
def test_malformed_or_supplier_pricing_inputs_rejected(change):
    with pytest.raises(ValidationError):
        replace(fixture()[2], **change)


def test_truthy_compatibility_string_is_rejected():
    with pytest.raises(ValidationError):
        replace(fixture()[1].qualifications[0], no_curved_jet_mini_confirmed="true")
