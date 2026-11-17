"""Synthetic dispatch/readback parity; fixture release is not gate qualification."""
import os
import sqlite3

import pytest

from test_commerce_workflows import connected, order, staff, auth
from services.commerce.app.workflows import Shipment, database, load, save


def snapshot():
    with sqlite3.connect(os.environ["SONORAN_DB_PATH"]) as db:
        return tuple(db.iterdump())


def fixture_order(client):
    receipt = order(client)
    # Isolated fixture precondition only, not real manufacturing or gate bypass.
    with database() as db:
        doc = load(db, receipt["id"])
        doc["status"] = "in_production"
        save(db, doc)
    return receipt


def dispatch(client, receipt, carrier, tracking):
    return client.post("/v1/admin/orders/" + receipt["id"] + "/ship",
        headers=staff(), json={"version": 1, "carrier": carrier, "tracking": tracking})


@pytest.mark.parametrize("control", ["\x00", "\t", "\n", "\r", "\x1b", "\x7f", "\x85", "\x9f"])
@pytest.mark.parametrize("field", ["carrier", "tracking"])
def test_control_rejected_before_mutation_then_corrected_customer_journey(connected, control, field):
    receipt = fixture_order(connected)
    before = snapshot()
    values = {"carrier": "TEST", "tracking": "SYNTHETIC-123"}
    values[field] = "before" + control + "after"
    assert dispatch(connected, receipt, **values).status_code == 422
    assert snapshot() == before
    readable = connected.get("/v1/orders/" + receipt["id"], headers=auth(receipt))
    assert readable.status_code == 200 and readable.json()["status"] == "in_production"
    corrected = dispatch(connected, receipt, "TEST", "SYNTHETIC-123")
    assert corrected.status_code == 200
    customer = connected.get("/v1/orders/" + receipt["id"], headers=auth(receipt))
    assert customer.status_code == 200
    assert customer.json()["shipment"] == {"carrier": "TEST", "tracking": "SYNTHETIC-123"}
    assert customer.json()["status"] == "shipped"
    after = snapshot()
    assert dispatch(connected, receipt, "TEST", "SYNTHETIC-123").status_code == 200
    assert snapshot() == after


@pytest.mark.parametrize("text", ["  José 🌵 / 0001  ", "東京便", "e\u0301", "A\u200dB", "A\u202eB", "A\u2028B", "A\u2029B", "\ufeffTEST"])
def test_noncontrol_unicode_preserved_in_dispatch_and_customer_readback(connected, text):
    receipt = fixture_order(connected)
    response = dispatch(connected, receipt, text, text)
    assert response.status_code == 200
    customer = connected.get("/v1/orders/" + receipt["id"], headers=auth(receipt))
    assert customer.status_code == 200
    assert customer.json()["shipment"] == {"carrier": text, "tracking": text}
    assert response.json()["shipment"] == customer.json()["shipment"]


@pytest.mark.parametrize("field", ["carrier", "tracking"])
def test_surrogates_rejected_by_same_unicode_boundary(field):
    values = {"version": 1, "carrier": "TEST", "tracking": "REF"}
    values[field] = "prefix\ud800suffix"
    with pytest.raises(ValueError):
        Shipment(**values)
