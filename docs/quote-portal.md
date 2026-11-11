# Private current-quote review

This RPG-121 slice replaces the quote dispatch with an isolated current-request consumer. The proof and Square order components and complete legacy component body are unchanged. It does not create quote history, pricing policy, payment, booking or manufacturing authority.

## Customer behavior

The private capability opens retail, bulk, event or contact requests. Submitted/unpriced requests remain readable. Contact requests never offer acceptance. A current complete offer displays its actual USD total, full message and recorded item summaries. Multiline message text (up to 3,000 Unicode code points) and valid supplementary Unicode are preserved and escaped, not injected as HTML. Up to 100 items are available in pages of 10; each displayed inscription retains its full backend limit.

Acceptance needs an explicit checkbox for the displayed version. The request uses the loaded immutable ID/version/capability, not edited inputs. A successful response must match ID, kind, version, accepted_version and accepted status, plus the exact displayed total, currency, message and item fields. Changed terms or inconsistent metadata produce a reconciliation message and require reopening. The UI never confirms acceptance of different terms.

A previously accepted record can be read but does not create a new success notification or request another acceptance. Confirmation identifies only the holder of the private access capability, not a verified person. Payment, event booking and production are separate.

Input edits, Close, Back, page exit, restored BFCache and unmount invalidate outstanding lookups/actions/errors. Ordinary initial pageshow does not erase input. A synchronous lock prevents duplicate clicks. Credentials remain in component memory, never URL, browser storage or logs.

## Testing

Routine Node coverage: `tests/frontend/quote-review.test.cjs`.
Headless browser coverage: `tests/e2e/quote-review.spec.ts`.
The existing CI-only invalid API origin is retained, with no production fallback.

After a local build with `NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid`, set `QUOTE_SMOKE_PYTHON` to the existing locked interpreter and `QUOTE_SMOKE_TEMP` to an owned short temporary directory, then run:

```text
node tests/frontend/quote-real-smoke.cjs
```

This separate integration smoke uses a real loopback ASGI app and isolated synthetic SQLite data. It creates/offers/accepts a quote through supported routes, verifies persisted exact-version acceptance and identical replay, and confirms a contact request remains read-only. No provider calls, real customers, secrets or live payments are involved. Owned hidden servers and headless browser are closed and temporary data removed; screenshots remain in artifacts.

Malformed or unsupported rendered state fails closed. This is a current-quote view, not a promise that historical revisions, identity verification, bookings or production are implemented.
