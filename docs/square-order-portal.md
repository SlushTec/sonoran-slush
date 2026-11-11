# Private order portal: Square sandbox alignment

This bounded RPG-125 consumer corrects the former Stripe-only browser guard to match the existing Square sandbox backend. It does not activate live payments, change prices, qualify production or add a simulator.

## Contract and boundaries

- The order-only component is separate from the unchanged quote and proof consumers.
- It uses the loaded order ID, positive safe-integer version and captured private capability. Editing either input, Close, Back, leaving, BFCache restoration or unmount invalidates outstanding responses and navigation. Duplicate actions are synchronously locked.
- Checkout requires strict server `test_payment_available === true`, unpaid/non-cancelled order, positive safe-integer reviewed total and USD. The backend still independently checks its own conditions.
- The response must identify provider `square`, literal `test_mode: true`, a nonblank bounded session identifier, and a whole raw URL matching `https://sandbox.square.link[:443]/u/[A-Za-z0-9_-]+`. No normalization or repair is performed. Queries, fragments, userinfo, alternate hosts/ports and trailing whitespace are rejected.
- A checkout redirect is not a payment confirmation. Errors require reopening the current order, not silently adopting a changed version.
- No payment-simulation action existed in the old order UI. None is invented here; synthetic retail orders remain excluded from provider checkout by the backend.
- Credentials stay in component memory, not storage, URLs, logs or analytics.
- Displayed strings reject malformed Unicode/control characters. Items are capped at 100 with 10 shown per page; event metadata is capped at 1,000 with 25 shown per page. Unsupported/malformed responses fail closed with a concise retry message rather than an unbounded render. These are UI safety limits, not a retention promise.

## Verification

Routine Node tests include `tests/frontend/order-review.test.cjs`. Browser coverage is in `tests/e2e/order-review.spec.ts`, with all external Square navigation intercepted before a network request. The existing CI-only invalid API origin is unchanged.

For the separately labeled real local ASGI smoke, build with `NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid`, set `SQUARE_SMOKE_PYTHON` to the existing locked interpreter and `SQUARE_SMOKE_TEMP` to an owned short temporary root, then run:

```text
node tests/frontend/order-real-smoke.cjs
```

This script starts an isolated synthetic database and real local API. It stubs the provider adapter only inside that test process and forbids urllib provider requests. It creates a quote, offers/accepts it, creates an order, exercises actual checkout/session replay, and verifies that opening checkout leaves payment unpaid. The headless browser intercepts the sandbox destination. This proves local integration, **not a connection to Square's real sandbox service**. Owned hidden processes, ports and temporary state are cleaned in finally; screenshots remain under the worktree artifacts directory.

No real provider credential, customer data, payment, deployment, AWS or WSL is involved.
