# Tab-scoped retail request recovery

RPG-121 bounded customer-safety slice. This is pricing-request recovery, not payment processing, an account, or exactly-once delivery.

## Data boundary
Session storage key `sonoran:retail-attempt` contains exactly schema version 1, an opaque UUID, and pending/confirmed state. It contains no contact/address, cart content, payload hash, access code, or receipt. Existing cart local storage is unchanged. Browser session restoration may retain this metadata; no guarantee of deletion when a tab/browser closes.

The UUID is an idempotency reference, not a bearer credential. Existing backend requires the complete matching normalized request to replay its receipt. No UUID-only lookup is added. A changed payload under the same UUID returns 409.

## State transitions
- Before dispatch, read/validate the marker, retain pending identity or create a new UUID only when no attempt exists, write and verify it.
- Unavailable, malformed or unexpectedly changed storage blocks dispatch. No silent storage-free fallback.
- Errors, timeouts, malformed receipts and 409 never reset pending identity.
- Reload restores the reference, not contact details. The customer explicitly re-enters/reviews and retries. No automatic retry or background request.
- Validated receipt remains memory/download-only. Confirmation status is saved separately. If saving status fails, show the receipt and warn; the pending marker remains conservative.
- Only an explicit Start another request action after confirmation resets the reference. It clears contact/consent state, not the existing bag. No reset control is offered for an ambiguous outcome.
- Saved-work cleanup does not erase an unresolved attempt marker. Clearing browser session data independently loses recovery metadata.

## Limits
Not cross-tab/device coordination, an atomic distributed lock, durable storage, payload restoration, or exactly-once delivery. Session storage can be cloned/restored/cleared by browsers. No guarantee when metadata is lost. The existing backend idempotency transaction remains authoritative. No payment/supplier/upload/deployment behavior changes.

## Synthetic validation
Actual browser: ambiguous response, reload, changed-payload 409, same-payload recovery, confirmation reload, explicit new identity, unavailable storage blocks fetch. DOM: strict schema, no extra fields, no pending reset, observed marker disappearance, read/write denial. Existing real local-backend replay and concurrency tests verify same-identity contract separately; mock browser responses alone do not establish server correctness.
