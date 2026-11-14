# Connected customer journey qualification

This extends the existing `tests/frontend/cross-portal-real-smoke.cjs` for RPG-121. It is a test-only acceptance slice, not new commerce functionality or a release approval.

## Actual exercised path

- An actual browser customizes a catalog tumbler, puts it in the bag, reloads the bag, and submits reviewed-pricing details through checkout.
- Browser commerce requests are relayed only to an owned loopback ASGI process using a fresh temporary SQLite database. After the first real quote commit, the harness deliberately discards the response. It checks the existing uncertainty notice, no immediate automatic retry, then explicitly retries.
- The retry must contain the identical complete request body and request ID, return the identical actual receipt, and leave the whole logical database fingerprint unchanged. The downloaded customer receipt is the quote used in subsequent steps.
- A synthetic staff session offers terms and prepares an order through the existing staff UI after customer quote acceptance. This is explicit test staff work, not automatic customer-to-production progression. Quote/order ancestry and engraving/quantity continuity are checked.
- Staff prepares the proof. The customer approves its exact current version, and the actual stored proof evidence must bind the same order. The previously opened order summary must require explicit review before downloading changed proof status, while still saying unpaid and not a paid receipt.
- Capability denials and the legacy inventory/capacity release hold must leave the whole temporary ledger unchanged. Private sessions are closed; capabilities and contact details must not appear in browser storage. The customizer's existing local design content is intentionally retained.

## Run

Build with `NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid`. Set `CROSS_SMOKE_PYTHON` to an existing interpreter with the repository's locked Python dependencies. Optionally set `CROSS_SMOKE_BROWSER` to an installed compatible browser executable (otherwise Playwright Chromium is used). Run `npm run test:cross-portal`.

The harness binds Python imports to this checkout, creates fresh loopback ports and synthetic credentials, disables payment activation and removes ambient provider settings from owned child environments. It blocks non-local/non-fixture browser traffic. Cleanup verifies owned processes and ports before deleting its temporary synthetic database. A failed cleanup is a failure, not success.

## Limits

This is one synthetic single-host path, not complete commerce qualification, concurrency/atomic cross-tab proof, or a durable/exactly-once guarantee. The delayed response is deliberately injected; no payment or supplier transport is mocked into success. Payment remains disabled and unpaid; fulfillment remains held. No real customer, artwork, account, provider, price approval, inventory, tax, shipping, supplier, deployment or production authorization is involved. Existing independent provider/business qualification remains required. Browser checks are not comprehensive accessibility or routing qualification.
