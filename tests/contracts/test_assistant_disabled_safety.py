"""Synthetic disabled-assistant privacy/fallback boundary; not model quality approval."""
from uuid import UUID
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from services.assistant.app.main import app as assistant
from services.commerce.app.main import app as commerce

CORPUS = json.loads((Path(__file__).parent / "fixtures" / "assistant-disabled-v1.json").read_text(encoding="utf-8"))


def assert_private_problem(response, status, code, private):
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error", "request_id"}
    assert set(body["error"]) == {"code", "message", "retryable"}
    assert body["error"]["code"] == code
    assert body["error"]["retryable"] is False
    assert str(UUID(body["request_id"])) == body["request_id"]
    assert response.headers["x-request-id"] == body["request_id"]
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert private not in response.text


@pytest.mark.parametrize("case", CORPUS["cases"], ids=lambda c: c["id"])
def test_disabled_assistant_never_executes_or_echoes(case, caplog):
    with TestClient(assistant) as client:
        # In-process ASGI transport needs no outbound socket or child process.
        with patch("socket.socket.connect", side_effect=AssertionError("network forbidden")), patch("subprocess.Popen", side_effect=AssertionError("process forbidden")):
            response = client.post("/v1/assist", json={"message": case["message"]})
    assert_private_problem(response, 503, "ASSISTANT_DISABLED", case["message"])
    assert case["message"] not in caplog.text


@pytest.mark.parametrize("payload", [
    {}, {"message": ""}, {"message": "x" * 2001}, {"message": None},
    {"message": ["private-sentinel"]}, {"message": {"private-sentinel": "value"}},
    {"message": "hello", "private-field-sentinel@example.invalid": "private-value"},
    {"message": "hello", "tool": "charge", "arguments": {"customer": "private-sentinel"}},
])
def test_invalid_assistant_input_is_redacted(payload):
    with TestClient(assistant) as client:
        response = client.post("/v1/assist", json=payload)
    assert_private_problem(response, 422, "VALIDATION_ERROR", "private-sentinel")
    assert "private-field-sentinel" not in response.text
    assert "private-value" not in response.text


def test_disabled_requests_do_not_interfere_with_public_catalog():
    with TestClient(commerce) as shop, TestClient(assistant) as helper:
        before = shop.get("/v1/catalog")
        ids = set()
        for _ in range(5):
            response = helper.post("/v1/assist", json={"message": "private-sentinel"})
            assert_private_problem(response, 503, "ASSISTANT_DISABLED", "private-sentinel")
            ids.add(response.json()["request_id"])
        after = shop.get("/v1/catalog")
        assert before.status_code == after.status_code == 200
        assert before.json() == after.json()
        assert len(ids) == 5
        assert helper.get("/ready").status_code == 503
        assert helper.get("/health").json()["live_integrations"] is False
