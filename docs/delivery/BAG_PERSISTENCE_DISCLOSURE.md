# Exact Bag persistence disclosure

The Bag previously promised 30-day device saving even after a cart write failed. External corrected red store-bag-storage-red-v2 showed visible quantity 2, persisted quantity 1 and that unconditional claim. The earlier diagnostic assumed a spinbutton instead of the actual quantity buttons and is retained separately as a fixture failure.

The Store's existing shared storageAvailable can be assigned from a named-design save, so it is not exact-cart authority. The unchanged three persistence attempts now capture the cart's existing verified readback separately, with the same immutable cart array identity. Attempt order, write count, shared flag aggregation, retained data, expiration and cart acceptance are unchanged. A new cart render cannot inherit an earlier array's success; unrelated named writes cannot assert success for an unsaved cart. No effect retry loop, extra persistence or state/schema migration is added.

Only the Bag consumes this exact status, with polite uncertainty and existing download/manage links. Named Save, Checkout and other consumers keep their prior semantics. Confirmation is point-in-time verification, not browser-eviction or cross-tab conflict protection. Readback denial may follow a successful write; warning therefore says unverified rather than definitely lost.

Four focused cases pass: throwing/silent/readback cart failures, visible quantity preservation and previous bytes where writes fail, unrelated named-save success, recovery after successful later cart write and a newer failure, unrelated favorites failure, hydration and first render of a new cart array. Native/cumulative qualification pending independent source review.
