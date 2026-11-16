"""Local ASGI dispatch validation; seeded release is not production-gate qualification."""
import os
import sqlite3

import pytest

from test_commerce_workflows import connected, order, staff
from services.commerce.app.workflows import database, load, save


def snapshot():
    with sqlite3.connect(os.environ["SONORAN_DB_PATH"]) as db:
        return tuple(db.iterdump())


def released_fixture(client):
    receipt = order(client)
    # Owned synthetic precondition only. No actual production release is performed.
    with database() as db:
        doc = load(db, receipt["id"])
        doc["status"] = "in_production"
        save(db, doc)
    return receipt


def ship(client, receipt, carrier, tracking, version=1):
    return client.post("/v1/admin/orders/" + receipt["id"] + "/ship",
        headers=staff(), json={"version": version, "carrier": carrier, "tracking": tracking})


@pytest.mark.parametrize("blank", ["", " ", "\t\n\r", "\u00a0", "\u2028\u2029", " \ufeff\t", "\u3000\u2007"])
@pytest.mark.parametrize("field", ["carrier", "tracking"])
def test_blank_dispatch_rejected_without_mutation_and_correctable(connected, blank, field):
    receipt = released_fixture(connected)
    before = snapshot()
    values = {"carrier": "TEST", "tracking": "SYNTHETIC-REFERENCE"}
    values[field] = blank
    assert ship(connected, receipt, **values).status_code == 422
    assert snapshot() == before
    corrected = ship(connected, receipt, "TEST", "SYNTHETIC-REFERENCE")
    assert corrected.status_code == 200
    assert corrected.json()["status"] == "shipped"


@pytest.mark.parametrize("carrier,tracking", [
    ("TEST", "SYNTHETIC-REFERENCE"),
    ("  Test Carrier  ", "  exact reference  "),
    ("\ufeffTEST", "José 🌵 / 0001"),
    ("C" * 100, "T" * 200),
])
def test_valid_dispatch_preserves_exact_values_and_replays_once(connected, carrier, tracking):
    receipt = released_fixture(connected)
    response = ship(connected, receipt, carrier, tracking)
    assert response.status_code == 200
    doc = response.json()
    assert doc["shipment"] == {"carrier": carrier, "tracking": tracking}
    assert len([event for event in doc["timeline"] if event["label"].startswith("Dispatched with ")]) == 1
    after = snapshot()
    replay = ship(connected, receipt, carrier, tracking)
    assert replay.status_code == 200 and replay.json() == doc
    assert snapshot() == after
    assert ship(connected, receipt, "OTHER", "OTHER").status_code == 409
    assert snapshot() == after


def test_version_and_release_gates_unchanged(connected):
    receipt = order(connected)
    before = snapshot()
    assert ship(connected, receipt, "TEST", "REFERENCE").status_code == 409
    assert ship(connected, receipt, "TEST", "REFERENCE", version=2).status_code == 409
    assert snapshot() == before
