"""Offline outbox lifecycle vocabulary. Not a worker, persistence or authorization gate.

Only synthetic tests use this module. Callers must separately prove event facts and
enforce fencing, ownership, business gates, retry bounds and provider semantics.
In particular, a transition permission is never permission to dispatch.
"""
from enum import Enum


class State(str, Enum):
    PENDING = "pending"
    LEASED = "leased"
    ATTEMPTING = "attempting"
    RETRY_WAIT = "retry_wait"
    UNKNOWN = "unknown"
    SUCCEEDED = "succeeded"
    CANCELLED = "cancelled"
    DEAD_LETTER = "dead_letter"


class Event(str, Enum):
    CLAIM = "claim"
    RELEASE_UNSENT = "release_unsent"
    CANCEL = "cancel"
    RECORD_ATTEMPT = "record_attempt"
    LEASE_EXPIRED = "lease_expired"
    CONFIRMED_SUCCESS = "confirmed_success"
    OUTCOME_LOST = "outcome_lost"
    VERIFIED_RETRYABLE_NONDELIVERY = "verified_retryable_nondelivery"
    VERIFIED_FINAL_NONDELIVERY = "verified_final_nondelivery"
    VERIFIED_CANCELLED_NONDELIVERY = "verified_cancelled_nondelivery"


_TRANSITIONS = {
    (State.PENDING, Event.CLAIM): State.LEASED,
    (State.PENDING, Event.CANCEL): State.CANCELLED,
    (State.RETRY_WAIT, Event.CLAIM): State.LEASED,
    (State.RETRY_WAIT, Event.CANCEL): State.CANCELLED,
    (State.LEASED, Event.RELEASE_UNSENT): State.PENDING,
    (State.LEASED, Event.CANCEL): State.CANCELLED,
    (State.LEASED, Event.RECORD_ATTEMPT): State.ATTEMPTING,
    (State.LEASED, Event.LEASE_EXPIRED): State.PENDING,
    (State.ATTEMPTING, Event.CONFIRMED_SUCCESS): State.SUCCEEDED,
    (State.ATTEMPTING, Event.OUTCOME_LOST): State.UNKNOWN,
    (State.ATTEMPTING, Event.LEASE_EXPIRED): State.UNKNOWN,
    (State.ATTEMPTING, Event.CANCEL): State.UNKNOWN,
    (State.UNKNOWN, Event.CANCEL): State.UNKNOWN,
    (State.UNKNOWN, Event.OUTCOME_LOST): State.UNKNOWN,
    (State.UNKNOWN, Event.LEASE_EXPIRED): State.UNKNOWN,
    (State.UNKNOWN, Event.CONFIRMED_SUCCESS): State.SUCCEEDED,
}
for _state in (State.ATTEMPTING, State.UNKNOWN):
    _TRANSITIONS[(_state, Event.VERIFIED_RETRYABLE_NONDELIVERY)] = State.RETRY_WAIT
    _TRANSITIONS[(_state, Event.VERIFIED_FINAL_NONDELIVERY)] = State.DEAD_LETTER
    _TRANSITIONS[(_state, Event.VERIFIED_CANCELLED_NONDELIVERY)] = State.CANCELLED


def next_state(state: State, event: Event) -> State:
    """Return a permitted lifecycle edge, rejecting all unspecified transitions.

    Strict enum inputs prevent arbitrary strings being silently accepted. Errors
    are static: never include caller input or any private/provider details.
    Terminal states have no outgoing edges; duplicate result handling belongs in
    a future fenced journal, not a second dispatch.
    """
    if type(state) is not State or type(event) is not Event:
        raise ValueError("Invalid outbox lifecycle input.")
    try:
        return _TRANSITIONS[(state, event)]
    except KeyError:
        raise ValueError("Outbox lifecycle transition is not permitted.") from None
