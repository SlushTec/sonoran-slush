# Checkout design-request download recovery

Isolated successor to 13936fdc. The existing inline download handler propagated a synchronous object-URL creation error without retry feedback. External store-checkout-download-red captured one uncaught error, empty status, unchanged cart/contact and zero submission attempts (one expected failing assertion).

The Checkout-only handler preserves the exact existing retail/items/paid payload and shared download helper. It reports started/check downloads, not a saved file or studio receipt; synchronous launch failure offers explicit retry. Cart identity changes clear stale status. Contact, consent, request state and persistence policies are unchanged.

Focused synthetic DOM proof: three cases pass for creation failure, anchor-click failure and cleanup failure. Failed click revokes its owned URL; creation failure owns none. Revocation failure after a successful click does not misreport failed launch. Explicit retry reads exact Blob bytes, verifies filename/current cart, and preserves contact, unchecked consent and zero network/session attempts. The focused harness executes the existing one-second cleanup callback immediately; it does not claim real browser timing or native file readback. Original red retained. Native and cumulative qualification remain pending independent source review.
