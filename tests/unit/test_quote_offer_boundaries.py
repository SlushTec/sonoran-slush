"""Synthetic in-process ASGI/SQLite offer boundaries, never live commercial terms."""
import os
import sqlite3

import pytest

from test_commerce_workflows import connected, quote, staff, auth


def snapshot():
    with sqlite3.connect(os.environ["SONORAN_DB_PATH"]) as db:
        return tuple(db.iterdump())


def offer(client, receipt, amount, version=1):
    return client.post("/v1/admin/quotes/" + receipt["id"] + "/offer",
        headers=staff(), json={"version": version, "total_minor": amount,
                              "message": "Synthetic reviewed terms, not a real offer"})


@pytest.mark.parametrize("invalid", [0, -1, 100000000, True, "1234", 1.5])
def test_invalid_total_preserves_database_and_original_version_for_correction(connected, invalid):
    receipt = quote(connected)
    before = snapshot()
    response = offer(connected, receipt, invalid)
    assert response.status_code == 422
    assert snapshot() == before
    corrected = offer(connected, receipt, 4205)
    assert corrected.status_code == 200
    assert corrected.json()["version"] == 2
    assert corrected.json()["total_minor"] == 4205
    assert corrected.json()["status"] == "offered"


@pytest.mark.parametrize("amount", [1, 1234, 99999999])
def test_exact_boundary_cents_persist_through_acceptance_and_stale_offer_is_atomic(connected, amount):
    receipt = quote(connected)
    offered = offer(connected, receipt, amount)
    assert offered.status_code == 200
    assert offered.json()["total_minor"] == amount
    assert type(offered.json()["total_minor"]) is int
    accepted = connected.post("/v1/quotes/" + receipt["id"] + "/accept",
        headers=auth(receipt), json={"version": 2, "decision": "accept"})
    assert accepted.status_code == 200
    assert accepted.json()["total_minor"] == amount
    assert accepted.json()["accepted_version"] == 2
    assert accepted.json()["status"] == "accepted"
    before = snapshot()
    assert offer(connected, receipt, 4205, version=1).status_code == 409
    assert snapshot() == before
    readback = connected.get("/v1/quotes/" + receipt["id"], headers=auth(receipt))
    assert readback.status_code == 200
    assert readback.json()["total_minor"] == amount
    assert readback.json()["accepted_version"] == 2
    summary = connected.get("/v1/admin/summary", headers=staff()).json()
    assert summary["counts"] == {"accepted": 1}
