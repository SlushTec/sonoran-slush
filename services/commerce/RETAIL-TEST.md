# Local retail and Square sandbox integration

Baseline: supplier-corrected `d05001f1bc2e4e6540bb72959a4e4ce7e1c3b667` (tree `9e410bbccf89a4beee5245a3e0fa7b97f1dfe173`). This lane changes only commerce, its generated OpenAPI and commerce tests/documentation. Parent coordinates independent integration review. The 24-card baseline and storefront are unchanged.

## Modes and running

Use the existing locked Python environment (`pip install -r requirements-dev.lock` when needed) and start `python -m uvicorn services.commerce.app.main:app --host 127.0.0.1 --port 8187` from repository root. Production startup remains rejected. `SONORAN_STAGE` must remain `scaffold`; local means the operating environment, not a new stage name.

Existing local workflow configuration: `SONORAN_REQUESTS_ENABLED=true`, persistent `SONORAN_DB_PATH`, stable `SONORAN_ACCESS_SECRET` (at least 32 characters) and separate `SONORAN_STAFF_TOKEN` (at least 32 characters). Keep these outside Git. No credentials were created or read for this delivery; tests supply only clearly synthetic values in isolated temporary databases.

The additional `SONORAN_RETAIL_TEST_ENABLED=true` gate enables synthetic offers, carts and stock. With no seeded offers the catalog is empty. Staff enters **test fixtures only**; they do not approve production prices, physical inventory, taxes, shipping, discounts or policies. Existing `/v1/catalog` remains unpriced/non-purchasable. `/ready` remains 503, production/live payment/live email/private-upload gates remain false. Capability flags now honor the stage restriction.

## Frontend and staff contract

All bodies reject unknown fields. Money and quantities are strict integers (booleans, floats and numeric strings rejected). USD only. Money must be 1–99,999,999 minor units, including the aggregate cart total. Quantities remain 1–500 per Item; 1–100 lines/cart. Errors use the existing redacted problem envelope; 401 staff authentication, 404 private-record ownership, 409 stale versions/conflicts/stock, 422 validation, 503 disabled configuration.

| Method/path | Body and result |
| --- | --- |
| POST `/v1/admin/retail-test/stock/{stock_id}` | Staff bearer; `{expected_version: 0, on_hand: 4}` creates synthetic stock. Revisions use the returned version and cannot go below active reservations. Returns stock_id/on_hand/reserved/version/test_mode. |
| POST `/v1/admin/retail-test/offers/{slug}` | Staff bearer; `{expected_version: 0, unit_price_minor: 1234, stock_id: "shared", units_per_item: 1}` creates an offer for an existing slug; subsequent writes require current version. Multiple listings can reference the same blank; set quantities multiply units_per_item. |
| GET `/v1/retail-test/catalog` | Returns `{test_mode: true, production_approved: false, offers: [...]}`. Offer fields: product_slug, version, unit_price_minor, currency, stock_id, units_per_item, test_mode. |
| POST `/v1/cart` | `{request_id: UUID, items: Item[]}` returns `{id, status, access_token}`. Same identity/content replays; changed content under the same identity conflicts. |
| GET `/v1/cart/{id}` | Cart-specific bearer. Returns version/status, items, priced lines, total_minor, currency, test_mode, pricing_scope, timestamps and optional order_id. A line has item, offer_version, unit_price_minor, line_total_minor, stock_id and stock_units. |
| POST `/v1/cart/{id}/orders` | Cart bearer plus `{version: 1}`. Atomically verifies frozen offers and reserves every shared blank; returns order receipt with its own bearer token. Retry returns the same order even after offer changes; insufficient stock reserves nothing. Changed offers require a new cart/request identity and user review. |
| GET `/v1/orders/{id}` | Existing order-specific bearer route. Retail orders add cart_id, lines, test_mode/retail_test, pricing_scope and reservation_status (`active`, `consumed`, `released`). |
| POST `/v1/orders/{id}/cancel-test` | Order bearer plus `{version}`. Only unpaid local retail orders without provider sessions can cancel. Repeated cancellation is harmless; releases exactly once. |
| POST `/v1/admin/retail-test/orders/{id}/payments` | Staff bearer; `{event_id: UUID, version: 1, amount_minor: 1234, currency: "USD", outcome: "paid"}` or outcome `failed`. Explicit local simulation, no provider call/charge. Failure leaves unpaid; duplicate identity/content replays; altered identity payload conflicts. |
| POST `/v1/admin/retail-test/orders/{id}/capacity` | Staff bearer plus `{version, confirmed: true/false}` persists the local capacity decision before release. Repeated identical decision is harmless. |

Existing proof creation/revision and customer approve/change paths remain. Revision invalidates prior approval. Existing staff release route retains its request shape (`version`, `inventory_reserved`, `capacity_confirmed`) for compatibility, but the booleans no longer supply authority: release reads persisted reservation and capacity state. Reservation units are consumed once in the release transaction. Existing dispatch route supports retry without duplicate dispatch.

**Legacy quote orders are deliberately blocked from production release until migrated to authoritative inventory/capacity records.** They retain quote, proof and sandbox-payment access. The earlier manually asserted inventory release is no longer accepted. This is an explicit integration change, not completed production inventory support.

## Optional multi-photo brief

`Item.photo_brief` is optional/null for backward compatibility. When present:

```json
{
  "instructions": "Composition instructions, up to 2000 characters",
  "photos": [
    {"local_file_id": "00000000-0000-4000-8000-000000000001", "filename": "sample.jpg", "note": "Up to 500 characters"}
  ],
  "media_uploaded": false
}
```

There must be 1–8 distinct UUID references, filename length 1–255, and no unknown fields. `media_uploaded: true` is rejected. The brief is durable in quote items, then copied to orders; also supported by retail cart items. Omitted/null briefs preserve old quote request fingerprints. **No image bytes, upload, file access, artifact readiness or preview fidelity is implied.** UI must retain local-only photo status. The brief stores metadata supplied by the user, not a verified media attachment; private uploads remain disabled.

## Square boundary

Square is the selected provider; the prior Stripe implementation is replaced, not supplemented. Existing merchant-account authorization/configuration is still external and was not accessed. Old Stripe runbook environment instructions do not apply to this adapter.

`POST /v1/checkout/sessions` keeps `{order_id, version}` and order bearer authentication; returns `{url, session_id, test_mode: true, provider: "square"}`. It accepts reviewed legacy quote orders, **never synthetic retail fixtures**. Square calls are fixed to `https://connect.squareupsandbox.com/v2/online-checkout/payment-links`, API version `2026-09-16`. Deterministic per-order/version idempotency survives a lost response and database rollback. Committed links replay locally only after URL validation. Buyer checkout URLs must match `https://sandbox.square.link/u/<opaque-token>` (optional explicit port 443); API and buyer hosts are distinct. Userinfo, non-default ports, queries, fragments and other paths/hosts are rejected. HTTP redirects are explicitly refused before a second request, including redirects to the same API host. Old stored links outside this allowlist require reconciliation. Previous provider sessions require reconciliation instead of silently switching.

Configuration (all sandbox, supplied separately only when authorized): `SONORAN_TEST_PAYMENTS_ENABLED=true`, `SQUARE_ENVIRONMENT=sandbox`, `SQUARE_SANDBOX_ACCESS_TOKEN`, `SQUARE_SANDBOX_LOCATION_ID`, `SQUARE_SANDBOX_MERCHANT_ID`, `SQUARE_SANDBOX_WEBHOOK_KEY`, exact `SQUARE_WEBHOOK_NOTIFICATION_URL`. No actual values are supplied by this delivery.

`POST /v1/webhooks/payments` now uses `x-square-hmacsha256-signature`: base64 HMAC-SHA256 over the configured notification URL followed by exact raw bytes. It accepts `payment.created`/`payment.updated`, but only COMPLETED payments without a reported nonzero refund can become paid. Verification binds merchant, location, payment identity, provider order/link, persisted local order version, integer amount and USD currency. Event identities/fingerprints and payment identities are durable and unique; retries do not duplicate payment transitions. Square does not use Stripe's timestamp signature format; delayed signed deliveries are handled by durable deduplication/version binding rather than an invented five-minute cutoff. Invalid/mismatched events cannot release production. A signed COMPLETED payment with nonzero USD `refunded_money` enters a durable `payment_reconciliation_required` state with `payment_status=reconciliation_required`; partial and full refunds both block payment authorization for production. The greatest reported cumulative refund is retained across out-of-order events. Neither old retries nor new no-refund events clear the hold. Malformed refund values are rejected. Initiating refunds, partial payments and resolving provider reconciliation remain out of scope.

Official references checked 2026-11-06:
- https://developer.squareup.com/reference/square/checkout/create-payment-link
- https://developer.squareup.com/docs/checkout-api/optional-checkout-configurations
- https://developer.squareup.com/docs/checkout-api/manage-checkout
- https://developer.squareup.com/reference/square/objects/payment
- https://developer.squareup.com/docs/webhooks/step3validate
- https://developer.squareup.com/reference/square/payments-api/webhooks/payment.updated

No Square network request occurred during tests. Transport is mocked; sandbox account integration and actual hosted checkout behavior remain unverified. The URL allowlist fails closed to the sandbox host; do not weaken it if future authorized provider testing returns another host without reviewing official evidence.

## Storage and operational limits

SQLite file-backed transactions (`BEGIN IMMEDIATE`, 15-second lock wait) serialize reservations, cancellation, payment updates and release. Stock/offer and payment-binding tables are additive. WAL initialization retries only SQLite BUSY-family failures within a 15-second deadline, restores the normal lock timeout after success, and closes connections if WAL or schema initialization fails. File permissions and access-secret fingerprint protection remain. This is a single-host local adapter, not DynamoDB or a production concurrency/backup qualification.

Reservations have no automatic expiry: unpaid tests require explicit cancellation, paid holds require staff reconciliation. No refund/restock API, external notification, image upload, live payment, legal/tax/shipping policy, production stock approval or live launch is included. General options are carried as request text under a synthetic base price; production option/variant surcharge rules are not approved by this slice.

## Validation receipt

Historical candidate `245f503e` author-run results (2026-11-06): **47 focused tests passed; 82 full Python tests passed**. Both runs have only the existing Starlette/httpx deprecation warning. OpenAPI generation check, 30 active-document links, and `git diff --check` pass. Archive verification passes for all 67 archived files and 41 retained business files. An initial aggregate run exposed the fresh-database WAL race described above (78 passed / 1 failed); after the fix, all final checks pass. No additional dependency installation was needed; reused the existing locked environment. Frontend/browser tests were not rerun for this backend-only slice. No actual Square network integration, AWS provision/deploy, live charge, notification, credentials, Linear change or worker launch occurred. Final commit/patch identifiers are reported to the parent after commit. Focused tests cover strict money/quantity validation, inherited crystal options, shared/set stock and atomic failure, independent-buyer contention, duplicate checkout, cancellation/payment race, proof revision, persisted capacity, process restart, Square signature/body/identity/amount/currency/version matching, event replay, provider timeout/retry and private metadata boundaries. Run `python -m pytest -q`, `python -m scripts.export_contracts --check`, and `python scripts/verify_archive.py` from repository root.

Follow-up to independent review (2026-11-06): corrected documented sandbox buyer URL validation, explicitly refused redirects, and added durable refund reconciliation holds. New offline tests cover documented responses, strict URL rejection, 301/302/303/307/308 redirects to same/other hosts with a real urllib opener and in-memory transport, signed partial/full refund events before/after payment, duplicate/out-of-order refunds, malformed refunds and stored legacy URL rejection. No provider services or actual credentials were used. Final author-run validation: **92 focused tests passed; 127 full Python tests passed**, with only the existing Starlette/httpx deprecation warning. OpenAPI generation check, all 30 active-document links, archive verification (67 archived + 41 retained files) and `git diff --check` passed. Frontend/browser and actual Square integration were not run for this backend-only follow-up.

Minimum integration: review the additive OpenAPI plus this document; opt frontend development into synthetic mode explicitly; keep reference catalog non-purchasable; serialize photo briefs only with local-media labeling; handle 409 by reloading/reviewing; keep Square setup and legacy inventory migration as separate gated work. No full production-ready claim.
