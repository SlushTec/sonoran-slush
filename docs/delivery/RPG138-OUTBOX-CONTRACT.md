# RPG-138 / SS-069: durable job intent and recovery contract

Status: proposed design and acceptance map, not implemented or activated.
Source reviewed: main `0aae8d3ef6ae33548c90d83d63b00a62fc6a418d`.
Scope: future synthetic-only local qualification before any production queue or provider.

## What exists and what does not

- `services/commerce/app/workflows.py::database` uses SQLite WAL and BEGIN IMMEDIATE, commits after the caller returns, and rolls back failures. This is an existing atomic boundary, not a durable worker.
- `services/commerce/app/retail.py::order_from_cart` writes the synthetic order, cart link and reservations in that transaction. Repeated current-version calls return the existing order. It does not enqueue or send customer notifications.
- `workflows.py::release_order` checks persisted payment, exact bound proof, stock reservation and capacity before synthetic release. `ship_order` records a dispatch; it does not invoke a carrier.
- `workflows.py::capabilities` explicitly reports live_email=false and production_ready=false.
- Existing request/payment-event identities do not establish exactly-once external execution. No durable outbox worker, lease, attempt journal or dead-letter replay service exists in these inspected paths.

## Required invariants

1. Intent is inserted in the SAME database transaction as its authoritative source transition. An intent failure rolls back the transition; a transition rollback leaves no intent. A side transaction or best-effort post-commit enqueue is insufficient.
2. Stable intent identity covers job kind, exact source record/version and destination scope. Same identity plus same canonical fingerprint replays; changed content conflicts. The worker never invents a fresh identity after a timeout.
3. Stored payload is a bounded allowlisted reference envelope, not arbitrary model text, raw artwork, credentials, payment details, supplier cost or an executable URL/command. Any later private lookup requires ownership and data-sharing authorization.
4. Claiming work uses atomic compare-and-swap with a monotonically increasing fencing token. Exactly one current lease may record a result. Clock values are server controlled and read inside the claim transaction.
5. Before an external attempt, revalidate consent, recipient/destination, current proof/version, payment, stock, spend and production gates applicable to that job. Cancellation or changed approval blocks stale queued work.
6. Persist an attempt identity BEFORE possible external dispatch. Never hold the SQLite write transaction across network calls. Recording success requires matching intent, attempt and current fencing token.
7. A timeout, crash after dispatch, or lost receipt means UNKNOWN outcome, not failed. Lease expiry does not itself make an unknown external action safe to repeat.
8. Automatic retries apply only to established non-delivery/transient failures or a provider operation whose idempotency contract and lifetime were independently qualified. Unknown outcomes require reconciliation with that exact provider identity; if unavailable, hold for operator review.
9. Retry limits, elapsed-age limits, backoff and provider idempotency lifetimes are explicit configuration, not hidden infinite loops. Production defaults and retry thresholds remain undecided here.
10. Staff replay requires current identity, eligible state, version, nonempty audit reason and rechecked business gates. Replay cannot clear an unknown outcome or bypass consent/payment/proof/stock/spend authorization.
11. Duplicate or out-of-order worker results cannot regress success, restart cancelled work, or overwrite a later generation. Audit entries distinguish intended, attempted, confirmed, reconciled and abandoned outcomes.
12. Ordinary catalog and existing local commerce continue if workers are disabled. A queue outage is not evidence that payment/order data was lost.

## Proposed state vocabulary

| State | Meaning | Allowed next decision |
| --- | --- | --- |
| pending | Intent committed; no attempt may have been sent | Claim if gates and schedule qualify |
| leased | Current fenced worker owns preparation | Release safely, cancel, or persist attempt before dispatch |
| attempting | External action may occur or have occurred | Record verified outcome; crash/timeout becomes unknown |
| retry_wait | Confirmed eligible retry, bounded schedule | Claim with new fencing token and same intent identity |
| unknown | Delivery/outcome cannot be established | Read-only reconciliation or explicit eligible operator decision |
| succeeded | Verified provider receipt or qualified synthetic effect | No further dispatch |
| cancelled | Intent invalidated before safe delivery | No dispatch; preserve history |
| dead_letter | Retry/age bound or permanent failure reached | Authorized inspect/replay only after cause corrected |

The states are a design vocabulary, not a database migration or API contract. In particular, stale leased work with a persisted attempt must not be treated like never-sent pending work.

## First implementation slice admission

Keep the first slice confined to an owned synthetic SQLite fixture, a deterministic in-process fake adapter, an injected clock and a test-only intent kind. No email, Square, QR+, supplier, model, shell, HTTP destination or background daemon. Use the existing transaction connection, not a new persistence layer. Do not change schema/bootstrap until the independent design review agrees on compatibility and rollback behavior. No real database is an input.

Admission prerequisites: independently reviewed envelope/state schema; exact source transition selected; schema/version handling; authorization model for operators; lock/concurrency tests; explicit synthetic-only adapter boundary. Missing production provider semantics do not block a disconnected fixture test, but must block provider activation.

## Acceptance matrix for SS-069

| Criterion | Required evidence | Current state |
| --- | --- | --- |
| AC1 atomic intent | Inject failure before/after each write; source and intent commit or roll back together | Not implemented |
| AC1 deduplication | Same identity replay; changed payload conflict; concurrent enqueue produces one intent | Not implemented |
| AC1 bounded failure | Fake clock proves retry/age ceiling and dead-letter reason; no busy retry storm | Not implemented |
| AC2 crash recovery | Crash before dispatch, after attempt record, after fake effect, before receipt; unknown never blindly retried | Not implemented |
| AC2 concurrency | Two workers, lease expiry, stale result/fencing rejection, clock boundary | Not implemented |
| AC2 reconciliation | Exact fake-provider identity lookup; unknown/no lookup stays held; repeated reconciliation idempotent | Not implemented |
| AC3 operator replay | Unauthorized/obsolete/missing-reason/wrong-kind requests denied; current gates rechecked | Not implemented |
| AC3 audit/privacy | No private payload/secret in log, error or dead-letter view; scoped inspection | Not implemented |
| Independence | Worker disabled/failing does not block catalog or mutate unrelated source records | Not implemented |

## Explicit non-goals and remaining decisions

This document does not satisfy full SS-069 or SS-070. Production storage/migration, private assets, retention/RPO/RTO, monitoring ownership, retry budgets, supplier/payment reconciliation semantics and authorized deployment remain open. Do not auto-close RPG-138. No worker is running, no real message is sent, and no live configuration is changed by this proposal.
