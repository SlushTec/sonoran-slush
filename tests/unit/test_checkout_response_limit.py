"""Bounded in-memory provider responses; never opens a network connection."""
import io
import json
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from services.commerce.app import payments

LINK = {"id": "synthetic-link", "order_id": "synthetic-order", "url": "https://sandbox.square.link/u/fixture"}
BODY = json.dumps({"payment_link": LINK}).encode()

def response_fixture(monkeypatch, body):
    monkeypatch.setenv("SQUARE_SANDBOX_ACCESS_TOKEN", "synthetic-token")
    stream = io.BytesIO(body)
    read_sizes = []
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): stream.close()
        def read(self, limit):
            read_sizes.append(limit)
            return stream.read(limit)
    opener = Mock()
    opener.open.return_value = Response()
    monkeypatch.setattr(payments.urllib.request, "build_opener", lambda *args: opener)
    return opener, read_sizes

@pytest.mark.parametrize("extra", [b" ", b"private-trailer", b"{}"])
def test_valid_prefix_does_not_hide_oversize_response(monkeypatch, extra):
    raw = BODY + b" " * (65536 - len(BODY)) + extra
    opener, sizes = response_fixture(monkeypatch, raw)
    with pytest.raises(HTTPException) as failure:
        payments.square_checkout({"idempotency_key": "synthetic"})
    assert failure.value.status_code == 502
    assert "private-trailer" not in failure.value.detail
    assert opener.open.call_count == 1
    assert sizes == [65537]

@pytest.mark.parametrize("length", [len(BODY), 65535, 65536])
def test_complete_response_at_or_below_cap_still_accepted(monkeypatch, length):
    opener, sizes = response_fixture(monkeypatch, BODY + b" " * (length - len(BODY)))
    assert payments.square_checkout({"idempotency_key": "synthetic"}) == LINK
    assert opener.open.call_count == 1
    assert sizes == [65537]

def test_overflow_not_passed_to_decoder(monkeypatch):
    response_fixture(monkeypatch, b"x" * 65537)
    decoder = Mock(side_effect=AssertionError("oversize must not decode"))
    monkeypatch.setattr(payments.json, "loads", decoder)
    with pytest.raises(HTTPException) as failure:
        payments.square_checkout({"idempotency_key": "synthetic"})
    assert failure.value.status_code == 502
    decoder.assert_not_called()
