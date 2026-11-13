"""Offline parser-boundary regressions; no provider calls or real secrets."""
import base64
import hashlib
import hmac
import pytest
from fastapi import HTTPException
from services.commerce.app.payments import verify_signature

URL = "https://example.invalid/synthetic-hook"
SECRET = "synthetic-only"

def signed(raw):
    return base64.b64encode(hmac.new(SECRET.encode(), URL.encode()+raw, hashlib.sha256).digest()).decode()

@pytest.mark.parametrize("opening,closing", [(b"[", b"]"), (b'{"nested":', b"}")])
def test_signed_deep_json_fails_closed(opening, closing):
    raw = b'{"event_id":"synthetic","nested":' + opening*2000 + b"0" + closing*2000 + b"}"
    assert len(raw) < 65536
    with pytest.raises(HTTPException) as caught:
        verify_signature(raw, signed(raw), SECRET, URL)
    assert caught.value.status_code == 400
    assert caught.value.detail == "The payment event could not be verified."

def test_ordinary_signed_event_preserves_payload():
    raw = b'{"event_id":"synthetic","nested":[{"value":1}]}'
    assert verify_signature(raw, signed(raw), SECRET, URL) == {"event_id":"synthetic", "nested":[{"value":1}]}

def test_unsigned_deep_json_never_reaches_parser():
    raw = b"["*2000 + b"0" + b"]"*2000
    with pytest.raises(HTTPException) as caught:
        verify_signature(raw, "invalid", SECRET, URL)
    assert caught.value.status_code == 400
    assert caught.value.detail == "The Square event signature could not be verified."
