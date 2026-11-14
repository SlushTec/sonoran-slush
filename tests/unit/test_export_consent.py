"""Synthetic metadata only; no customer image, identity or supplier is contacted."""
from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from services.commerce.app.domain.export_consent import (
    ExportBinding, TransferRequest, Consent, review_export_consent,
)

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def change(record, **changes):
    return type(record).model_validate({**record.model_dump(), **changes})


def fixture():
    binding = ExportBinding(order_id="synthetic-order", asset_id="synthetic-asset",
        export_sha256="a"*64, proof_id="synthetic-proof", proof_version=1,
        configuration_sha256="b"*64)
    request = TransferRequest(binding=binding, recipient_id="synthetic-supplier",
        purpose="supplier_conversion", policy_version="synthetic-policy-1")
    consent = Consent(consent_id="synthetic-consent", subject_id="synthetic-subject",
        request=request, reproduction_permitted=True, transfer_permitted=True,
        state="active", granted_at=NOW-timedelta(hours=1), expires_at=NOW+timedelta(hours=1))
    return request, binding, consent


def test_exact_scope_is_review_only_and_pure():
    request, binding, consent = fixture()
    before = [r.model_dump_json() for r in (request, binding, consent)]
    result = review_export_consent(request, binding, consent.subject_id, consent, NOW)
    assert result.status == "ready_for_owner_review"
    assert result.transfer_authorized is False
    assert before == [r.model_dump_json() for r in (request, binding, consent)]
    assert result == review_export_consent(request, binding, consent.subject_id, consent, NOW)


@pytest.mark.parametrize("field,value", [
    ("order_id","other"), ("asset_id","other"), ("export_sha256","c"*64),
    ("proof_id","other"), ("proof_version",2), ("configuration_sha256","d"*64),
])
def test_changed_current_binding_blocks(field,value):
    request,binding,consent=fixture()
    result=review_export_consent(request,change(binding,**{field:value}),consent.subject_id,consent,NOW)
    assert result.status=="held" and "CURRENT_EXPORT_MISMATCH" in result.reasons


@pytest.mark.parametrize("field,value", [
    ("recipient_id","different"), ("purpose","supplier_manufacture"), ("policy_version","new"),
])
def test_permission_cannot_follow_new_recipient_purpose_policy(field,value):
    request,binding,consent=fixture()
    result=review_export_consent(change(request,**{field:value}),binding,consent.subject_id,consent,NOW)
    assert "CONSENT_SCOPE_MISMATCH" in result.reasons


@pytest.mark.parametrize("changes,reason", [
    ({"state":"withdrawn"},"CONSENT_WITHDRAWN"),
    ({"reproduction_permitted":False},"PERMISSION_MISSING"),
    ({"transfer_permitted":False},"PERMISSION_MISSING"),
    ({"subject_id":"different"},"CONSENT_SUBJECT_MISMATCH"),
])
def test_permission_and_ownership_are_independent(changes,reason):
    request,binding,consent=fixture()
    result=review_export_consent(request,binding,consent.subject_id,change(consent,**changes),NOW)
    assert result.status=="held" and reason in result.reasons


def test_missing_future_and_expired_consent_fail_closed():
    request,binding,consent=fixture()
    assert review_export_consent(request,binding,consent.subject_id,None,NOW).reasons==("CONSENT_MISSING",)
    for instant in (consent.granted_at-timedelta(microseconds=1),consent.expires_at):
        assert "CONSENT_NOT_CURRENT" in review_export_consent(request,binding,consent.subject_id,consent,instant).reasons
    assert review_export_consent(request,binding,consent.subject_id,consent,consent.granted_at).status=="ready_for_owner_review"


def test_invalid_contracts_rejected_without_coercion():
    request,binding,consent=fixture()
    for changes in ({"proof_version":True},{"proof_version":"1"},{"asset_id":"bad\nvalue"}):
        with pytest.raises(ValidationError): change(binding,**changes)
    for changes in ({"transfer_permitted":"true"},{"expires_at":consent.granted_at},{"granted_at":NOW.replace(tzinfo=None)}):
        with pytest.raises(ValidationError): change(consent,**changes)
    with pytest.raises(ValueError):
        review_export_consent(request,binding,consent.subject_id,consent,NOW.replace(tzinfo=None))
