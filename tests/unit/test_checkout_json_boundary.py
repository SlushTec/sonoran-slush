"""Offline checkout decoder boundary; no real token or provider traffic."""
import json
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from services.commerce.app import payments

def fake_transport(monkeypatch, raw):
    monkeypatch.setenv("SQUARE_SANDBOX_ACCESS_TOKEN", "synthetic-not-a-token")
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, limit):
            assert limit == 65537
            return raw
    opener = Mock()
    opener.open.return_value = Response()
    monkeypatch.setattr(payments.urllib.request, "build_opener", lambda *args: opener)
    return opener

def test_decoder_recursion_is_generic_provider_failure(monkeypatch):
    opener = fake_transport(monkeypatch, b"{}")
    monkeypatch.setattr(payments.json, "loads", Mock(side_effect=RecursionError("private-provider-marker")))
    with pytest.raises(HTTPException) as failure:
        payments.square_checkout({"idempotency_key": "synthetic"})
    assert failure.value.status_code == 502
    assert failure.value.detail == "Square did not confirm a sandbox session. Retry the same order."
    assert "private-provider-marker" not in failure.value.detail
    assert opener.open.call_count == 1

def test_native_deep_response_respects_decoder_boundary(monkeypatch):
    raw = b"[" * 2000 + b"0" + b"]" * 2000
    fake_transport(monkeypatch, raw)
    with pytest.raises(HTTPException) as failure:
        payments.square_checkout({"idempotency_key": "synthetic"})
    assert failure.value.status_code == 502

def test_unrelated_memory_error_is_not_swallowed(monkeypatch):
    fake_transport(monkeypatch, b"{}")
    monkeypatch.setattr(payments.json, "loads", Mock(side_effect=MemoryError("synthetic")))
    with pytest.raises(MemoryError):
        payments.square_checkout({"idempotency_key": "synthetic"})

def test_valid_response_still_accepted(monkeypatch):
    link = {"id": "fixture-link", "order_id": "fixture-order", "url": "https://sandbox.square.link/u/fixture"}
    fake_transport(monkeypatch, json.dumps({"payment_link": link}).encode())
    assert payments.square_checkout({"idempotency_key": "synthetic"}) == link
