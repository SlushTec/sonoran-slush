# Native notification requirements

Preserve the intent of the historical email map, not Shopify setup instructions.
Events: paid order receipt, missing-artwork request, proof ready, revision, approval confirmation,
production update when meaningful, shipping/pickup, delivery where carrier evidence supports it,
quote response, event request/hold/confirmation, deposit/balance receipt and issue resolution.

Use durable outbox records, retries with backoff, deduplication and staff-visible failure status.
SES production access/domain verification and bounce/complaint handling are launch gates.
Marketing/abandoned-checkout messages require separately reviewed consent rules; transaction is not consent.
Never send real mail from local/staging fixtures. Recipient gift surprises and private artwork need explicit handling.
No sending service or marketing automation is enabled in this foundation.
