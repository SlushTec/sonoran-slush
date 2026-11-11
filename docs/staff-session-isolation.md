# Staff workspace session isolation

This bounded RPG-122 / SS-071 repair addresses a reproduced public-source race: an old quote-offer response could repopulate a locked workspace and start another summary request with the captured old staff credential.

## Behavior

The existing component now binds requests to an immutable staff session and record-context generation. Lock, credential edit, Back, page exit, BFCache restoration and unmount invalidate pending results. Record-reference edits invalidate the record context and clear its authority. Every async success, error and finally checks the originating session/context.

Lock clears the staff credential, summary, record, reference, private receipt, status/errors and every form draft, including proof text, carrier, tracking, price/message and readiness checkboxes. New records cannot inherit another record's forms. Lock remains available during login or mutation. Synchronous locks prevent duplicate dispatch before React state updates.

**Lock hides and forgets the browser session; it does not cancel or revoke a server action already submitted.** A response received after invalidation cannot restore private data, show an old receipt, or start a new summary request. Already-started requests may still finish on the server.

Same-record mutation responses must retain the original record identity/kind and a valid version. Existing order/proof creation returns a new receipt ID, so those operations retain their genuine receipt semantics. Receipts are cleared before another action or record change and cannot be downloaded after Lock.

A verified write followed by a failed overview refresh is reported as a confirmed action with a stale overview, explicitly warning not to repeat the mutation. An unverified write response requires reconciliation; it is not called a success. Backend endpoints, permissions, versions, payment/production gates and actual staff capabilities are unchanged.

## Verification

Routine Node tests: `tests/frontend/staff-session.test.cjs`.
Headless browser tests: `tests/e2e/staff-session.spec.ts`.

The separately labeled real ASGI smoke uses only isolated synthetic local state:

```text
node tests/frontend/staff-real-smoke.cjs
```

Set `STAFF_SMOKE_PYTHON` to the existing locked interpreter and `STAFF_SMOKE_TEMP` to an owned short temporary root. Build with the existing QA-only invalid API origin first. The smoke uses supported staff quote/order routes, checks Lock/reopen, and downloads a synthetic receipt into its temporary directory for validation without logging its access code. All owned hidden servers, headless browsers and temporary receipt/database files are cleaned; screenshot evidence is retained.

No real staff account, settings change, provider call, deployment, AWS or WSL is involved. This is a browser lifecycle repair, not a claim of complete production staff authorization or audit coverage.
