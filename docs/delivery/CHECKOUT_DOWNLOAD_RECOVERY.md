# Checkout design-request download recovery

Isolated successor to 13936fdc. The existing inline download handler propagated a synchronous object-URL creation error without retry feedback. External store-checkout-download-red captured one uncaught error, empty status, unchanged cart/contact and zero submission attempts (one expected failing assertion).

The Checkout-only handler preserves the exact existing retail/items/paid payload and shared download helper. It reports started/check downloads, not a saved file or studio receipt; synchronous launch failure offers explicit retry. Cart identity changes clear stale status. Contact, consent, request state and persistence policies are unchanged.

Focused synthetic DOM proof: three cases pass for creation failure, anchor-click failure and cleanup failure. Failed click revokes its owned URL; creation failure owns none. Revocation failure after a successful click does not misreport failed launch. Explicit retry reads exact Blob bytes, verifies filename/current cart, and preserves contact, unchecked consent and zero network/session attempts. The focused harness executes the existing one-second cleanup callback immediately; it does not claim real browser timing or native file readback. Original red retained. Native and cumulative qualification remain pending independent source review.

## Final qualification

On frozen 91a580f: native four cases passed in14.3s, create/click failures at390/1280 followed by explicit keyboard retry and actual downloaded JSON readback. Original cart bytes, contact, unchecked consent, zero POSTs/session attempts and no page errors were asserted. Failed-click cleanup and delayed successful-click cleanup were observed; cleanup-error suppression remains focused DOM proof only.

Frontend coverage passed as split704 tests (7.117s) plus the initially omitted unchanged staff-offer-validation script's11 tests (1.523s). The union exactly matches all eight files in current test:frontend; this was not one715-test invocation. Types, export build/check (72pages/4399links/40images), standalone build and archive67+41 passed. Original red retained. Ancillary preview NoFallbackError remains in native log.

Both screenshots inspected:1280 shows readable failure status and retained button focus;390 capture shows retained contact at page top, not the below-fold status, so no mobile target-pixel acceptance claim. Native mobile assertions passed. Owned session65304 closed;4305 listener and candidate Node processes absent. No server submission, real commerce or publication performed.
