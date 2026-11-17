"""Synthetic combined consent holds and clock boundaries; never dispatch authority."""
from datetime import datetime, timedelta, timezone
from itertools import product

import pytest

from services.commerce.app.domain.export_consent import (
    ExportBinding, TransferRequest, Consent, review_export_consent,
)

NOW = datetime(2026, 11, 16, 12, tzinfo=timezone.utc)


def changed(record, **changes):
    return type(record).model_validate({**record.model_dump(), **changes})


def records():
    binding = ExportBinding(order_id="synthetic-order", asset_id="synthetic-asset",
        export_sha256="a" * 64, proof_id="synthetic-proof", proof_version=1,
        configuration_sha256="b" * 64)
    request = TransferRequest(binding=binding, recipient_id="synthetic-recipient",
        purpose="supplier_conversion", policy_version="synthetic-policy")
    consent = Consent(consent_id="synthetic-consent", subject_id="synthetic-subject",
        request=request, reproduction_permitted=True, transfer_permitted=True,
        state="active", granted_at=NOW-timedelta(hours=1), expires_at=NOW+timedelta(hours=1))
    return binding, request, consent


@pytest.mark.parametrize("denials", list(product((False, True), repeat=6)))
@pytest.mark.parametrize("clock", ["current", "before", "expired"])
def test_combined_independent_holds_never_authorize_transfer(denials, clock):
    binding, request, consent = records()
    binding_bad, subject_bad, scope_bad, withdrawn, reproduction_denied, transfer_denied = denials
    current = changed(binding, proof_version=2) if binding_bad else binding
    subject = "synthetic-other" if subject_bad else consent.subject_id
    consent = changed(consent,
        request=changed(request, recipient_id="synthetic-other") if scope_bad else request,
        state="withdrawn" if withdrawn else "active",
        reproduction_permitted=not reproduction_denied,
        transfer_permitted=not transfer_denied)
    instant = {"current": NOW, "before": consent.granted_at-timedelta(microseconds=1),
               "expired": consent.expires_at}[clock]
    before = [r.model_dump_json() for r in (current, request, consent)]
    result = review_export_consent(request, current, subject, consent, instant)
    expected = []
    for denied, reason in [(binding_bad,"CURRENT_EXPORT_MISMATCH"),
        (subject_bad,"CONSENT_SUBJECT_MISMATCH"), (scope_bad,"CONSENT_SCOPE_MISMATCH"),
        (withdrawn,"CONSENT_WITHDRAWN"),
        (reproduction_denied or transfer_denied,"PERMISSION_MISSING"),
        (clock != "current","CONSENT_NOT_CURRENT")]:
        if denied:
            expected.append(reason)
    assert result.reasons == tuple(expected)
    assert result.status == ("held" if expected else "ready_for_owner_review")
    assert result.transfer_authorized is False
    assert before == [r.model_dump_json() for r in (current, request, consent)]


@pytest.mark.parametrize("offset", [-720, -420, 0, 330, 345, 840])
@pytest.mark.parametrize("edge,delta,ready", [
    ("granted_at", -1, False), ("granted_at", 0, True),
    ("expires_at", -1, True), ("expires_at", 0, False),
])
def test_timezone_equivalent_instants_preserve_half_open_interval(offset, edge, delta, ready):
    binding, request, consent = records()
    instant = (getattr(consent, edge)+timedelta(microseconds=delta)).astimezone(
        timezone(timedelta(minutes=offset)))
    result = review_export_consent(request, binding, consent.subject_id, consent, instant)
    assert result.status == ("ready_for_owner_review" if ready else "held")
    assert result.reasons == (() if ready else ("CONSENT_NOT_CURRENT",))
    assert result.transfer_authorized is False


def test_prior_ready_result_is_not_authority_after_consent_withdrawal_or_expiry():
    binding, request, consent = records()
    ready = review_export_consent(request, binding, consent.subject_id, consent, NOW)
    assert ready.status == "ready_for_owner_review"
    for current_consent, instant, expected in [
        (changed(consent, state="withdrawn"), NOW, "CONSENT_WITHDRAWN"),
        (consent, consent.expires_at, "CONSENT_NOT_CURRENT"),
    ]:
        result = review_export_consent(request, binding, consent.subject_id, current_consent, instant)
        assert result.status == "held"
        assert expected in result.reasons
        assert ready.transfer_authorized is result.transfer_authorized is False
