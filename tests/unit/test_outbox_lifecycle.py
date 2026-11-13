"""Synthetic disconnected lifecycle tests, not provider or durable-worker proof."""
import pytest
from services.commerce.outbox_lifecycle import Event, State, next_state


@pytest.mark.parametrize("state", [State.SUCCEEDED, State.CANCELLED, State.DEAD_LETTER])
@pytest.mark.parametrize("event", list(Event))
def test_terminal_states_cannot_restart(state, event):
    with pytest.raises(ValueError):
        next_state(state, event)


@pytest.mark.parametrize("event", [Event.CLAIM, Event.RECORD_ATTEMPT, Event.RELEASE_UNSENT])
def test_unknown_outcome_cannot_be_redispatched(event):
    with pytest.raises(ValueError):
        next_state(State.UNKNOWN, event)


@pytest.mark.parametrize("event", [Event.CANCEL, Event.LEASE_EXPIRED, Event.OUTCOME_LOST])
def test_persisted_attempt_requires_reconciliation(event):
    assert next_state(State.ATTEMPTING, event) is State.UNKNOWN
    assert next_state(State.UNKNOWN, event) is State.UNKNOWN


def test_confirmed_delivery_after_cancel_request_is_not_falsely_cancelled():
    state = next_state(State.ATTEMPTING, Event.CANCEL)
    assert next_state(state, Event.CONFIRMED_SUCCESS) is State.SUCCEEDED


@pytest.mark.parametrize("state", [State.ATTEMPTING, State.UNKNOWN])
@pytest.mark.parametrize("event,expected", [
    (Event.VERIFIED_RETRYABLE_NONDELIVERY, State.RETRY_WAIT),
    (Event.VERIFIED_FINAL_NONDELIVERY, State.DEAD_LETTER),
    (Event.VERIFIED_CANCELLED_NONDELIVERY, State.CANCELLED),
])
def test_verified_nondelivery_decisions(state, event, expected):
    assert next_state(state, event) is expected


def test_happy_synthetic_lifecycle():
    state = State.PENDING
    for event in [Event.CLAIM, Event.RECORD_ATTEMPT, Event.CONFIRMED_SUCCESS]:
        state = next_state(state, event)
    assert state is State.SUCCEEDED


def test_safe_unsent_lease_expiry():
    assert next_state(State.LEASED, Event.LEASE_EXPIRED) is State.PENDING
    assert next_state(State.LEASED, Event.RELEASE_UNSENT) is State.PENDING


@pytest.mark.parametrize("state,event", [
    ("private@example.invalid", Event.CLAIM),
    (State.PENDING, "secret-invalid-event"),
    (None, Event.CLAIM), (State.PENDING, None),
    ("pending", Event.CLAIM), (State.PENDING, "claim"),
])
def test_invalid_inputs_are_strict_and_not_echoed(state, event):
    with pytest.raises(ValueError, match=r"^Invalid outbox lifecycle input\.$"):
        next_state(state, event)


@pytest.mark.parametrize("state", [State.PENDING, State.RETRY_WAIT])
def test_no_success_without_persisted_attempt(state):
    with pytest.raises(ValueError):
        next_state(state, Event.CONFIRMED_SUCCESS)
    assert next_state(state, Event.CANCEL) is State.CANCELLED
