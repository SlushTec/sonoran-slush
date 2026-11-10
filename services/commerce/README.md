# Commerce boundary

FastAPI catalog plus explicitly opt-in local request workflows.
Default configuration remains closed to submissions and payments; readiness stays false.

Implemented local paths include:

- Consent-validated inquiries with transactional duplicate protection.
- Hashed, record-specific guest access codes; separate staff credentials.
- Versioned staff quote offers and customer acceptance.
- Order preparation only from an accepted current retail/bulk quote.
- Versioned text proofs, approval/change decisions, and invalidation on revision.
- Independent payment, exact proof, inventory, and capacity production gates.
- Dispatch records with idempotent retry.
- Test-mode-only Stripe hosted sessions, server-authoritative totals, signed test webhooks,
  amount/currency/order/version/session binding, and duplicate payment-event protection.

No production DynamoDB adapter, Cognito authorization, private artwork upload pipeline,
live charging/refunds, live event confirmation/deposit workflow, or notification sender is enabled.
The optional local workflow is for private integration work, not public commerce.
Original images are outside this delivery.

See [local workflow instructions](../../docs/runbooks/STOREFRONT-REVIEW.md).
