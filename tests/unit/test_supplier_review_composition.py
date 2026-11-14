"""Test-only ledger/proof-to-review composition, NOT a supplier/photo adapter.

The existing tumbler fixture exercises record plumbing only. Its synthetic
mapping is not a claim that this product is a supplier crystal or supported job.
"""
import pytest
from fastapi import HTTPException
from test_commerce_workflows import connected, proof
from test_proof_evidence import decide, dump
from test_retail_durability import setup, cart, purchase, simulate
from test_qr_fulfillment import fixture, replace
from services.commerce.app.workflows import database, load, save
from services.commerce.app import proof_evidence
from services.commerce.app.domain.prerequisites import ProductionPrerequisites
from services.commerce.app.domain.qr_fulfillment import Choice, Request, RetailApproval, plan_fulfillment


def review(order_id, proof_id):
    # Test harness only: never registered as a service/HTTP endpoint. Trust comes
    # from the temporary ledger and immutable proof verifier, not caller flags.
    with database() as db:
        order = load(db, order_id)
        current = load(db, proof_id)
        revision, decisions = proof_evidence.verify(db, current, order)
        local = Choice(product_id=order['items'][0]['product_slug'])
        request, policy, _, _ = fixture()
        mapping = replace(policy.mappings[0], local=local)
        qualification = replace(policy.qualifications[0], mapping_fingerprint=mapping.fingerprint())
        policy = replace(policy, allowed_choices=(local,), mappings=(mapping,), qualifications=(qualification,))
        retail = RetailApproval(quote_id=order_id, current_version=str(order['version']),
            accepted_version=str(order['version']), local=local,
            quantity=order['items'][0]['quantity'], unit_price_minor=order['lines'][0]['unit_price_minor'],
            currency=order['currency'])
        gate = ProductionPrerequisites(payment_rule_satisfied=order['payment_status']=='paid',
            inventory_reserved=True, capacity_confirmed=True, proof_required=True,
            current_proof_version=str(current['version']),
            approved_proof_version=str(current['approved_version']) if current.get('approved_version') else None)
        # Inventory/capacity above are explicitly synthetic scenario inputs, not
        # verified production authority. This test covers payment/proof binding.
        return plan_fulfillment(Request(local=local, quantity=retail.quantity), policy, retail, gate), revision


def prepared(client, monkeypatch):
    setup(client, monkeypatch)
    order = purchase(client, cart(client)).json()
    current = proof(client, order)
    return order, current


def test_payment_and_exact_approval_are_independent_review_gates(connected, monkeypatch):
    order, current = prepared(connected, monkeypatch)
    assert review(order['id'], current['id'])[0].status == 'held'
    assert decide(connected, current).status_code == 200
    assert review(order['id'], current['id'])[0].status == 'held'
    assert simulate(connected, order).status_code == 200
    before = dump()
    result, revision = review(order['id'], current['id'])
    assert result.status == 'ready_for_owner_review'
    assert result.execution_authorized is False
    assert result.plan.customer_retail.unit_price_minor == 1234
    assert result.plan.customer_retail.quantity == 1
    assert revision['context_hash']
    assert review(order['id'], current['id']) == (result, revision)
    assert dump() == before


def test_payment_without_approval_does_not_produce_review_plan(connected, monkeypatch):
    order, current = prepared(connected, monkeypatch)
    assert simulate(connected, order).status_code == 200
    result, _ = review(order['id'], current['id'])
    assert result.status == 'held' and result.plan is None


def test_new_proof_requires_new_approval_despite_verified_payment(connected, monkeypatch):
    order, current = prepared(connected, monkeypatch)
    assert decide(connected, current).status_code == 200
    assert simulate(connected, order).status_code == 200
    new = proof(connected, order, 1)
    assert decide(connected, current).status_code == 409
    assert review(order['id'], new['id'])[0].status == 'held'
    assert decide(connected, new, version=2).status_code == 200
    assert review(order['id'], new['id'])[0].status == 'ready_for_owner_review'


@pytest.mark.parametrize('field', ['total_minor', 'items'])
def test_material_change_fails_bound_review_without_writes(connected, monkeypatch, field):
    order, current = prepared(connected, monkeypatch)
    assert decide(connected, current).status_code == 200
    assert simulate(connected, order).status_code == 200
    with database() as db:
        record = load(db, order['id'])
        if field == 'total_minor': record[field] += 1
        else: record['items'][0]['text'] = 'Changed after approval'
        save(db, record)
    before = dump()
    with pytest.raises(HTTPException) as caught:
        review(order['id'], current['id'])
    assert caught.value.status_code == 409
    assert dump() == before
