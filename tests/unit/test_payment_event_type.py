"""Signed synthetic events only; unknown valid event kinds remain ignored."""
import pytest
from unittest.mock import Mock
from services.commerce.app import payments
from test_commerce_workflows import connected, send_event

@pytest.mark.parametrize("kind", [[], {}, {"private": "marker"}, 1, True, None, ""])
def test_invalid_event_type_is_controlled_before_database(connected, monkeypatch, kind):
    database = Mock(side_effect=AssertionError("database must not be reached"))
    monkeypatch.setattr(payments, "database", database)
    payload = {"event_id": "synthetic-event", "merchant_id": "merchant-test", "type": kind}
    response = send_event(connected, payload)
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "The event type is invalid."
    database.assert_not_called()

def test_missing_event_type_is_rejected(connected):
    response = send_event(connected, {"event_id": "synthetic-event", "merchant_id": "merchant-test"})
    assert response.status_code == 400

def test_unknown_string_event_type_remains_ignored(connected, monkeypatch):
    database = Mock(side_effect=AssertionError("database must not be reached"))
    monkeypatch.setattr(payments, "database", database)
    response = send_event(connected, {"event_id": "synthetic-event", "merchant_id": "merchant-test", "type": "inventory.updated"})
    assert response.status_code == 200
    assert response.json() == {"received": True, "applied": False}
    database.assert_not_called()

def test_signature_still_precedes_type_validation(connected):
    response = send_event(connected, {"event_id": "synthetic-event", "merchant_id": "merchant-test", "type": []}, valid=False)
    assert response.status_code == 400
    assert "signature" in response.json()["error"]["message"]
