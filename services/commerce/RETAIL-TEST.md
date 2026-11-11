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
| GET `/v1/orders/{id}` | Existing order-specific bearer route. Retail orders add cart_id, lines, test_mode/retail_test, pricing_scope and reservation_status (`active`, `consumed`, `released`, `expired`). |
| POST `/v1/orders/{id}/cancel-test` | Order bearer plus `{version}`. Only unpaid local retail orders without provider sessions can cancel. Repeated cancellation is harmless; releases exactly once. |
| POST `/v1/admin/retail-test/orders/{id}/payments` | Staff bearer; `{event_id: UUID, version: 1, amount_minor: 1234, currency: "USD", outcome: "paid"}` or outcome `failed`. Explicit local simulation, no provider call/charge. Failure leaves unpaid; duplicate identity/content replays; altered identity payload conflicts. |
| POST `/v1/admin/retail-test/orders/{id}/hold-deadline` | Staff bearer plus `{version, test_hold_expires_at}`. Explicit timezone-aware ISO string, future on first assignment, immutable thereafter; same instant replays. Test fixture only, no default duration. |
| POST `/v1/admin/retail-test/orders/{id}/expire` | Staff bearer plus `{version}`. At/after the explicit deadline, atomically releases a complete, demonstrably unpaid synthetic hold. No caller-supplied clock; paid/ambiguous/provider-linked holds conflict without release. |
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

Reservations have no background expiry scheduler or default duration. Synthetic holds can opt into the explicit test-deadline workflow below; existing records without a deadline retain their previous behavior. Paid or ambiguous holds require manual reconciliation and are never automatically released. No refund/restock API, external notification, image upload, live payment, legal/tax/shipping policy, production stock approval or live launch is included. General options are carried as request text under a synthetic base price; production option/variant surcharge rules are not approved by this slice.

## Validation receipt

Historical candidate `245f503e` author-run results (2026-11-06): **47 focused tests passed; 82 full Python tests passed**. Both runs have only the existing Starlette/httpx deprecation warning. OpenAPI generation check, 30 active-document links, and `git diff --check` pass. Archive verification passes for all 67 archived files and 41 retained business files. An initial aggregate run exposed the fresh-database WAL race described above (78 passed / 1 failed); after the fix, all final checks pass. No additional dependency installation was needed; reused the existing locked environment. Frontend/browser tests were not rerun for this backend-only slice. No actual Square network integration, AWS provision/deploy, live charge, notification, credentials, Linear change or worker launch occurred. Final commit/patch identifiers are reported to the parent after commit. Focused tests cover strict money/quantity validation, inherited crystal options, shared/set stock and atomic failure, independent-buyer contention, duplicate checkout, cancellation/payment race, proof revision, persisted capacity, process restart, Square signature/body/identity/amount/currency/version matching, event replay, provider timeout/retry and private metadata boundaries. Run `python -m pytest -q`, `python -m scripts.export_contracts --check`, and `python scripts/verify_archive.py` from repository root.

Follow-up to independent review (2026-11-06): corrected documented sandbox buyer URL validation, explicitly refused redirects, and added durable refund reconciliation holds. New offline tests cover documented responses, strict URL rejection, 301/302/303/307/308 redirects to same/other hosts with a real urllib opener and in-memory transport, signed partial/full refund events before/after payment, duplicate/out-of-order refunds, malformed refunds and stored legacy URL rejection. No provider services or actual credentials were used. Final author-run validation: **92 focused tests passed; 127 full Python tests passed**, with only the existing Starlette/httpx deprecation warning. OpenAPI generation check, all 30 active-document links, archive verification (67 archived + 41 retained files) and `git diff --check` passed. Frontend/browser and actual Square integration were not run for this backend-only follow-up.

Minimum integration: review the additive OpenAPI plus this document; opt frontend development into synthetic mode explicitly; keep reference catalog non-purchasable; serialize photo briefs only with local-media labeling; handle 409 by reloading/reviewing; keep Square setup and legacy inventory migration as separate gated work. No full production-ready claim.


## Synthetic reservation expiry (RPG-124 / SS-047)

This bounded local/test slice does not approve production hold timing, duration, inventory or late-payment policy.
Staff may assign one `test_hold_expires_at` only to an active, fully reserved, demonstrably unpaid synthetic order.
The value is normalized to UTC, must be later than the transaction's current time on first assignment, and cannot
be shortened or extended. An identical normalized deadline replays without changing state. No deadline is inferred
for old orders. Missing deadlines, stale versions, naive/numeric dates, unauthorized access and unexpected fields fail closed.

Expiry is explicit, per order, via the staff endpoint. A valid simulated paid event also checks the deadline in its
own transaction, so missing an expiry invocation cannot turn an overdue payment into fulfillment authority.
The injectable clock is a callable sampled after `BEGIN IMMEDIATE`, not a client field or a timestamp captured
before waiting for the write lock. At the exact deadline the unpaid hold is expired; before it the hold remains active.
No scheduler, poller or production default is installed.

- Expiry compares every active persisted component/quantity with the frozen order lines before changing anything.
  It leaves `on_hand` unchanged, moves those reservation rows from `active` to `released`, and records
  `reservation_status=expired`, `status=reservation_expired`, `inventory_reserved=false` and `reservation_expired_at`.
  Existing SQLite table constraints are unchanged; the order document distinguishes expiry from cancellation.
- The order, exact reservation rows and late-payment event/recovery record commit or roll back together.
  Repeated expiry/cancellation is harmless; checkout retries return the original order and do not reacquire stock.
  Another buyer may reserve the freed components, but a late event never takes them back.
- Only the exact `unpaid` state without provider metadata or existing Square session/payment bindings is eligible.
  Paid, pending, unknown and reconciliation states retain stock. An ambiguous provider-linked record must be manually
  reconciled, even if its document says unpaid. Local simulation cannot resolve that ambiguity.
- A valid simulated paid event at/after expiry sets `payment_status=reconciliation_required`,
  `status=payment_reconciliation_required` and `payment_recovery_reason=reservation_expired`.
  The response is `received=true`, `applied=false`, `recovery_required=true`, `test_mode=true`.
  Here `applied` means ordinary paid authorization, not merely receiving the event. The recovery hold is durable and
  sticky across same-event retries, new paid events, failed events and restart; changed content under an event ID conflicts.
  This slice has no recovery-resolution, refund, restock or production-release shortcut.
- Paid-before-deadline holds remain reserved afterward. A cancellation that wins before expiry remains cancelled,
  and its later payment simulation is still rejected. Expired orders cannot gain proof revisions/decisions or capacity
  changes; persisted payment, proof, stock and capacity checks continue to independently gate release.

No destructive database migration is required: deadlines and recovery reasons are additive order-document fields;
old records have no deadline unless explicitly assigned one. All existing WAL initialization and transaction behavior is reused.
Rollback: disable synthetic retail writes, retain the test database and recovery evidence, then revert the reviewed feature
commit through the normal reviewed process. Older code does not enforce the new deadlines; do not resume it against these
holds while assuming expiry/recovery support. No production data or provider state is changed by this slice.

Validation commands use the unchanged locked Python dependencies. On Windows set `PYTHONUTF8=1` for each test process;
the default legacy code-page invocation does not pass the repository's UTF-8 document-link checks. The shared reviewed
harness prefix adds compact IDs to the six existing SVG resource-limit cases to avoid Windows' environment-variable length
limit without changing payloads or assertions. Aggregate baseline on that prefix: 312 passed, 94 subtests passed, one existing
Starlette/httpx deprecation warning. This is not evidence of completed COM-02 or SS-047 acceptance or production qualification.


Author validation on the frozen expiry candidate (2026-11-10, with `PYTHONUTF8=1`):
`python -m pytest -q tests/unit/test_reservation_expiry.py` passed **51 tests**;
`python -m pytest -q` passed **363 tests and 94 subtests**, with only the existing Starlette/httpx warning.
Coverage includes exact deadline boundaries, strict input/auth/stage gates, immutable replay, multi-component release,
unknown/paid/provider-bound holds (including incomplete metadata), cancellation/payment/buyer races, a clock advanced
while waiting for the database lock, full transaction rollback, independent-process restart and cross-process contention.
`python -m scripts.export_contracts --check`, `python scripts/verify_archive.py` (67 archived / 41 retained),
`python scripts/check_links.py` (31 links) and `git diff --check` pass. Infrastructure and CI workflows are unchanged.
Independent review and exact-head CI remain pending at author freeze. No frontend/browser checks, real provider calls,
production stock qualification, deployment or activation were performed by this backend-only candidate.


Independent review correction: timezone-aware inputs whose UTC normalization would fall outside years 1 through 9999
now return validation error 422 before any order mutation, rather than raising an unhandled overflow. Both lower/upper
boundary inputs have regression coverage. The corrected candidate requires re-review at its new exact commit/tree.


## Synthetic isolated restore drill (RPG-138 / SS-070)

`tests/unit/test_sqlite_restore_drill.py` is a test-only drill, not a backup service, restore endpoint or operator tool.
It accepts no existing database or asset directory. Each test creates its own fresh root, database and deterministic
byte fixtures. The fixture replaces the database path and synthetic access configuration only inside the test process;
it never reads a real `.env` file or uses ambient provider credentials. Square is disabled, provider/HTTP/DNS transports
fail fast, and raw socket connects are blocked after the test client's internal event-loop startup and before fixture work.
No external action is attempted during seeding, backup, restore or replay. Readiness, live payments and private uploads stay false.

The fixture uses the existing local APIs to create unpaid, paid, consumed, cancelled, expired and late-payment-recovery
orders with exact current proof versions and local file-reference metadata. Independent assertions establish expected
stock totals, line amounts, reference identities, access fingerprints and request/payment-event fingerprints before sealing
any snapshot. A separate read transaction keeps committed frames in the source WAL. SQLite's connection backup API uses
another read connection; a concurrent uncommitted write is excluded. The snapshot is finalized into standalone DELETE mode,
so copying only the live main database file is explicitly rejected by a negative test.

Restore validates the internally owned snapshot before opening the application or creating a target: exact owned file/directory
identities, no links/reparse points/hard-link aliases or extra sidecars, bounded sizes, supported harness format, hashes,
SQLite integrity, complete schema/rows, required access fingerprint and synthetic reference bytes. Hashes check integrity;
even a byte-identical unregistered bundle is not authorized source. The harness format and its expected fixture header are
not an application schema/behavior-version compatibility or migration mechanism. Restores use exclusive fresh target
creation and never replace an existing file, directory or sidecar. Failed partial outputs remain isolated and unaccepted;
the harness does not clean or overwrite them, and a retry must choose another fresh target.

After raw validation, the restored application must replay cart/order/request/payment identities without duplicate stock or
payment transitions, reject changed retries and unauthorized reads, preserve expired/reconciliation holds, and remain offline.
A success marker is set only after validation and replay. Separate checks exercise post-restore expiry, paid-hold protection
and wrong-secret failure. Negative tests mutate only their own synthetic copies and cover corrupt/truncated/main-file-only
images, unsupported format/header, missing or mismatched state/references, unsafe targets/aliases, resource bounds, copy
interruption and post-copy validation failure. Source main-file/WAL/fixture bytes are preserved during the drill; SHM reader
lock bytes are transient and are not represented as backed-up state. Every connection is closed after its test.

Run with `python -X utf8 -m pytest -q tests/unit/test_sqlite_restore_drill.py`. For local work, pass a **new, nonexistent**
`--basetemp` directory on the authorized workspace volume; pytest may remove a pre-existing base. The tests use pytest-owned
roots and remain platform-neutral for CI. Parameter IDs are compact, including size/resource cases; no resource tests are skipped.
Windows junctions and hard links, or POSIX symbolic links and hard links, exercise actual filesystem alias rejection.

**NOT ASSESSED:** job/outbox recovery (no implemented queue), real private-asset storage/recovery, historical proof-file
recovery (the local current proof document is updated in place), production schema/behavior-version qualification, cloud
persistence or restore, financial/supplier reconnection, production RPO/RTO, backup costs or retention. The byte fixtures are
not uploaded private assets, and metadata hashes confer no asset authorization. This is a controlled single-process synthetic
harness, not protection against an untrusted process racing arbitrary namespace changes. Full SS-064, SS-068, SS-069, SS-070
and OPS-04 acceptance and all owner decisions remain open. A snapshot's existence alone is not acceptance.

## Synthetic component ledger (RPG-124 / partial SS-044)

The staff-only `/v1/admin/retail-test/component-ledger` routes use the same opt-in retail/scaffold/staff gates.
They are a disconnected fixture ledger, **not checkout inventory**. Every returned record marks `test_mode: true`
and `checkout_authoritative: false`. No fixture movement updates `retail_stock`, affects offer availability,
approves a proof/payment, or authorizes production. Do not enter real stock or private supplier/customer data.

- `PUT /components/{id}` accepts `kind` (blank/base/box/consumable) and an integer-count unit
  (piece/millilitre/gram/millimetre). Definitions are immutable; identical replay succeeds, changed content conflicts.
- `PUT /locations/{id}` accepts fixture `kind` workshop/market, with the same immutable behavior.
- `PUT /lots/{id}` binds `component_id`, `supplier_reference`, `lot_reference` once. The component must exist.
- `POST /lots/{id}/movements` takes UUID `request_id`, strict integer `expected_version`, `quantity` 1–1,000,000,
  `purpose` receipt/transfer/count_correction, optional `source`/`destination` buckets and a nonblank single-line
  `reason` of at most 200 characters. A bucket has `location_id` and condition
  available/damaged/sample/in_production/completed/shipped. A receipt has destination only; a transfer needs two
  distinct buckets; a count correction has exactly one leg. All referenced locations must exist.
- `GET /lots/{id}` returns the definition, current version and ordered balances. `limit` defaults to 50, maximum 100;
  follow `next_offset` using `offset` and restart if `version` changes while paging.
- `GET /lots/{id}/movements` returns audit history in sequence order, with `after` and `limit` (maximum 100), and
  `next_after` while more records exist. Version is current at that read; append-only history may grow between pages.

The existing `BEGIN IMMEDIATE` transaction covers replay lookup, version check, both balance legs, version increment
and audit insert. A failure rolls all of them back. Balances never go below zero or above the supported per-bucket
1,000,000 units. Transfers conserve quantity; only explicit fixture receipts or reasoned count corrections change it.
UUID request identities are ledger-global, not reusable for another lot or changed payload. An exact retry returns
its original recorded receipt even if later lot versions exist. Audit time comes from the server. The actor is
`synthetic_staff`, explicitly representing the shared staff test credential, **not per-person production attribution**.
Do not supply `actor`, credentials, prices or business authority in a body; extra fields are rejected.

This additive prototype creates only its own `fixture_*` tables in the existing local test database. No migration of
retail stock occurs. Rollback: disable the test gate, preserve the database and movement history, then revert the source
through review; do not delete test tables as a rollback shortcut. Individual production identities, bills of materials,
lot-level reservations, inspected eligibility, real stock/costs, physical counts, purchasing, production policies,
managed persistence and full SS-044/COM-02 qualification remain open. No provider, deployment or live activation.


## Fixture BOMs and component reservations (continued partial SS-044/SS-047)

Under the same staff-only component-ledger prefix, immutable BOM versions bind an existing reference product
to defined component IDs and positive integer units per output. Component units are copied from authoritative
fixture definitions, never caller-supplied. A BOM can contain different units for different components; a given
component's frozen unit cannot change. This remains a synthetic planning model, not a sellable product definition.

- PUT/GET /boms/{id}/versions/{revision}: body product_slug and components[{component_id,units_per_item}].
  Revision1..1,000,000 is immutable. Reordered identical component definitions replay; changed contents conflict.
- POST /boms/{id}/versions/{revision}/plan: quantity1..500 and allocations[{lot_id,location_id,units}].
  Allocations must fulfill every component exactly, without duplicate lot/location buckets, unknown components,
  damaged/sample/production stock, overflow or insufficient free units. Returns frozen BOM, allocation details,
  physical/reserved/free units and current lot_versions. This call does not reserve anything.
- POST /boms/{id}/versions/{revision}/reservations: same plan plus UUID request_id, exact lot_versions map and
  reason. All components reserve atomically or none do. No lot selection, substitution, expiry or duration policy
  is inferred. New fixture holds are active/version1 and preserve the exact BOM snapshot.
- GET /reservations/{id}: staff-only current fixture hold.
- POST /reservations/{id}/release or /consume: UUID request_id, expected_version, exact current lot_versions
  and reason. Only current active holds transition. Release frees once without changing physical stock.
  Consume atomically moves its units from available to in_production condition; this does NOT authorize real
  manufacturing. Existing payment/proof/capacity and retail production-release gates remain untouched.

Lot balances remain physical quantities. Use the plan's reserved/free fields for fixture availability, never
assume a raw available-condition balance is unreserved stock. Every fixture movement that reduces available units
now checks the active-reservation floor, including transfers and negative count corrections. Release/consume
increments each affected lot once, even with allocations at multiple locations. Other active holds stay protected.
Command identities are ledger-global across movements/reserve/release/consume: exact retries return the recorded
receipt, including after later versions; changed payload or cross-operation reuse conflicts. All legs, lot/hold versions
and audit writes are one database transaction. Incomplete active allocation records fail closed for reconciliation.

No actual inventory, production hold duration, checkout integration, supplier/provider action, price, purchasing or
live activation. The shared synthetic staff actor is not individual production identity. Inspection eligibility,
real product BOMs, managed persistence, authorized production transitions, expiry policy and full SS-044/SS-047/COM-02
qualification remain open. Disable the test gate and preserve history before a reviewed revert; do not revert to the
earlier ledger against active holds while assuming it still protects reserved stock.

Per-lot reservation audit is separate from the earlier physical movement stream: GET /lots/{id}/reservation-events
uses bounded after/limit paging (maximum100) and records reserve/release/consume actor/reason/time, hold identity,
allocations and resulting lot version. Read both streams when reconciling lot history. The event insert is part of
the same transaction; exact command replay never appends another event. This does not create a production audit service.


## Commercial snapshot fixtures (RPG-123 / partial SS-006)

The new staff-only /v1/admin/retail-test/commercial routes use the existing opt-in retail/scaffold/staff gates.
This is an isolated fixture registry. Every successful response says test_mode true, owner_approved false and
production_approved false, including replay. approved_test is a simulated review state of the shared synthetic
staff credential. It is NOT owner approval, separate-person review, commercial approval or permission to sell.

POST /snapshots/{id}/versions/{revision} creates the next immutable content revision. Body fields:
request_id UUID, previous_revision, source_reference (fixture reference key), kind and rows.
Supported narrow kinds:
- catalog: product_slug and strict fixture_eligible boolean, unique products from the current reference catalog.
- prices: product_slug, variant_key, strict positive unit_price_minor integer and USD currency, unique product/variant.
- policies: policy_key and bounded nonblank fixture_text, unique keys. Only synthetic text; no actual customer promises.
Each kind accepts1..100 rows and rejects unknown fields/authority assertions. A snapshot identity cannot change kind.
GET /snapshots/{id}/versions/{revision} reads current lifecycle metadata without rewriting immutable content.

POST /snapshots/{id}/versions/{revision}/review-test requires request_id, expected_lifecycle_version,
decision approve_test/retire_test and a nonblank reason. Only drafts can be test-approved; retirement is terminal.
A new draft revision does not silently rewrite older approved-test content or historical records.

POST /sets/{id} requires request_id and exact catalog/prices/policies references, each snapshot_id/revision.
Every reference must have the exact kind and approved_test state. Fixture eligible products must match priced products
exactly. The set retains content hashes, references and audit. These hashes prove consistency, not real source authority.
Options, tax, machine profiles, owner identity and production remain explicitly unqualified.

POST /current-test selects set_id with request_id, expected_pointer_version, action publish_test/rollback_test and reason.
The pointer uses compare-and-set, records immutable publication history and rejects concurrent stale updates.
Rollback requires a previously published set whose exact references are still approved_test and unchanged.
GET /current-test resolves only the current valid test set; retiring a reference or detecting content mismatch fails closed.
It does not silently fall back to stale prices/policies. GET /sets/{id} is a historical manifest, not a valid-current claim.

UUID identities are global within the commercial-fixture command namespace across create/review/set/select.
Exact replay returns its original receipt even after later state changes; changed or cross-operation reuse conflicts.
All state, publication history and command/audit writes are transactional. Corrupt receipt/snapshot/set/pointer JSON
returns controlled reconciliation errors. Historical snapshots and all existing orders remain untouched.

No real price proposals, internal costs, customer files, current retail offers or public catalog records are imported.
No application/assistant consumer uses this fixture pointer. Existing public catalog stays non-purchasable and /ready503.
No provider, production owner identity, actual approval, deployment or live activation. Full SS-006/COM-01 remains open.
Disable the test gate and preserve fixture history before a normal reviewed source revert; do not delete records as rollback.

Persisted fixture documents are independently type-checked before return or mutation: snapshot row schemas and kind/identity,
audit/lifecycle shape, exact typed manifest references and hashes, and pointer identity/publication provenance. Null audits,
list-valued references and invalid pointer IDs return409 for reconciliation. This boundary validation is not a repair tool
or proof of source authority; malformed records are preserved, not silently rewritten or treated as approved business data.
