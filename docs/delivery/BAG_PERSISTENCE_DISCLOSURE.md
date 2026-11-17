# Exact Bag persistence disclosure

The Bag previously promised 30-day device saving even after a cart write failed. External corrected red store-bag-storage-red-v2 showed visible quantity 2, persisted quantity 1 and that unconditional claim. The earlier diagnostic assumed a spinbutton instead of the actual quantity buttons and is retained separately as a fixture failure.

The Store's existing shared storageAvailable can be assigned from a named-design save, so it is not exact-cart authority. The unchanged three persistence attempts now capture the cart's existing verified readback separately, with the same immutable cart array identity. Attempt order, write count, shared flag aggregation, retained data, expiration and cart acceptance are unchanged. A new cart render cannot inherit an earlier array's success; unrelated named writes cannot assert success for an unsaved cart. No effect retry loop, extra persistence or state/schema migration is added.

Only the Bag consumes this exact status, with polite uncertainty and existing download/manage links. Named Save, Checkout and other consumers keep their prior semantics. Confirmation is point-in-time verification, not browser-eviction or cross-tab conflict protection. Readback denial may follow a successful write; warning therefore says unverified rather than definitely lost.

Four focused cases pass: throwing/silent/readback cart failures, visible quantity preservation and previous bytes where writes fail, unrelated named-save success, recovery after successful later cart write and a newer failure, unrelated favorites failure, hydration and first render of a new cart array. Native/cumulative qualification pending independent source review.

## Final qualification on eaae619896fc34d7e899d25d005eddf0eaee1e17

Final frontend 710/710 passed in 7.103s; typecheck, export build/check (72 pages, 4,399 links, 40 images), standalone build and archive (67 archived/41 unchanged) passed. Four actual Edge cases at 390/1280 passed in 7.3s: selective throwing/silent cart writes, exact old persisted bytes with newer visible quantities, explicit downloaded JSON readback containing the current unsaved quantity/text, later verified write, newer failure and reload of the last persisted quantity. Readback-denial and unrelated named-save ownership remain focused DOM proof, not native claims.

Both actual warning/download screenshots were inspected; target warning and recovery control are visible at both widths. Sticky header overlays upper content outside the target; no whole-page, physical-device or manual assistive qualification. Ancillary preview NoFallbackError is retained, not clean server-log acceptance. Original valid red and earlier spinbutton diagnostic remain separate. All jobs closed and port 4303 released. No failed final stage, repeated suite, policy change or public action. This documentation-only record does not change qualified product/tests.
