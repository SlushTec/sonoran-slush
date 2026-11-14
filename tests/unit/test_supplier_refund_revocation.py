"""Offline refund-to-review boundary; no production supplier integration.

Quote-derived test order, mocked Square checkout, signed synthetic webhook and
real temporary ledger/proof verifier. Supplier/inventory/capacity remain fixture
assumptions. Synthetic retail orders' processor prohibition is not bypassed.
"""
import pytest
from test_commerce_workflows import (
    connected, inquiry, offer_accept, staff, proof, session, payment_event, send_event,
)
from test_proof_evidence import decide, dump
from test_qr_fulfillment import fixture, replace
from services.commerce.app import proof_evidence
from services.commerce.app.workflows import database, load
from services.commerce.app.domain.qr_fulfillment import Choice, plan_fulfillment


def prepared(client, monkeypatch):
    body = inquiry()
    body['items'][0]['quantity'] = 1  # exact total is also the unit price
    response = client.post('/v1/quotes', json=body)
    assert response.status_code == 200
    quote = response.json()
    offer_accept(client, quote)
    response = client.post('/v1/admin/orders', json={'quote_id':quote['id'], 'version':2}, headers=staff())
    assert response.status_code == 200
    order = response.json()
    current = proof(client, order)
    assert decide(client, current).status_code == 200
    session(client, order, monkeypatch)  # existing mocked provider helper
    return order, current


def review(order_id, proof_id):
    with database() as db:
        order = load(db, order_id)
        current = load(db, proof_id)
        proof_evidence.verify(db, current, order)
        assert len(order['items']) == 1 and order['items'][0]['quantity'] == 1
        request, policy, retail, gate = fixture()
        local = Choice(product_id=order['items'][0]['product_slug'])
        mapping = replace(policy.mappings[0], local=local)
        qualification = replace(policy.qualifications[0], mapping_fingerprint=mapping.fingerprint())
        policy = replace(policy, allowed_choices=(local,), mappings=(mapping,), qualifications=(qualification,))
        retail = replace(retail, quote_id=order_id, current_version=str(order['version']),
                         accepted_version=str(order['version']), local=local, quantity=1,
                         unit_price_minor=order['total_minor'], currency=order['currency'])
        gate = replace(gate, payment_rule_satisfied=order['payment_status']=='paid',
                       current_proof_version=str(current['version']),
                       approved_proof_version=str(current['approved_version']))
        return plan_fulfillment(replace(request, local=local, quantity=1), policy, retail, gate)


def assert_held_without_review_writes(order, current, refund):
    before = dump()
    result = review(order['id'], current['id'])
    assert result.status == 'held' and result.plan is None
    assert result.execution_authorized is False
    assert dump() == before
    with database() as db:
        record = load(db, order['id'])
        assert record['payment_status'] == 'reconciliation_required'
        assert record['refunded_minor'] == refund


@pytest.mark.parametrize('refund', [1, 12345])
def test_signed_refund_revokes_ready_review_and_replays_cannot_reopen(connected, monkeypatch, refund):
    order, current = prepared(connected, monkeypatch)
    paid = payment_event(order['id'], event_id='original-paid')
    assert send_event(connected, paid).json()['applied'] is True
    before = dump()
    result = review(order['id'], current['id'])
    assert result.status == 'ready_for_owner_review'
    assert result.execution_authorized is False
    assert result.plan.customer_retail.unit_price_minor == 12345
    assert dump() == before
    refunded = payment_event(order['id'], event_id='refunded')
    refunded['data']['object']['payment']['refunded_money'] = {'amount':refund, 'currency':'USD'}
    response = send_event(connected, refunded)
    assert response.status_code == 200 and response.json()['reconciliation_required'] is True
    assert_held_without_review_writes(order, current, refund)
    before = dump()
    assert send_event(connected, refunded).json()['applied'] is False
    assert send_event(connected, paid).json()['applied'] is False
    assert send_event(connected, payment_event(order['id'], event_id='late-paid')).status_code == 409
    assert dump() == before
    assert_held_without_review_writes(order, current, refund)
    # An older lower refund notification must not lower the durable amount or
    # reopen the review. This is event ordering, not a refund API operation.
    older = payment_event(order['id'], event_id='older-refund')
    older['data']['object']['payment']['refunded_money'] = {'amount':1, 'currency':'USD'}
    assert send_event(connected, older).status_code == 200
    assert_held_without_review_writes(order, current, refund)
