# Saved design capacity: private qualification
Baseline: f47336aa19507d051835a7ccabbb6051b20a0043.

SS-010 data preservation: a new saved ID must not evict acknowledged drafts at the existing 100-design limit. Existing IDs remain editable; deliberate removal makes room. No retention, source metadata, commercial policy or backend contracts changed.

The initial saveDesign-only guard exposed two caller defects during independent review. Save & start another reset the current editor after capacity rejection; bag addition separately truncated the saved list. The shared canSaveDesign predicate now guards both save actions before editor/photo mutation and the functional bag-side saved update. A valid bag addition still proceeds, explicitly reporting that the full saved list did not accept another design. Storage denial remains distinct: an accepted design can stay in memory for the visit, and existing truthful visit-only feedback is preserved.

## Evidence
External logs under D:\dot-workspace\store-saved-capacity-*:
- Original DOM red: new ID wrongly returned true at capacity; retained.
- Native red: both Save & start another and bag addition reproduced the missing capacity disclosure; two failures retained.
- New native: 7 passed, 1280/390 repeated saves, both save buttons, bag success without saved eviction, reload, exact collection values/order, current text, and pending photo ownership.
- Maintained native: 12 passed (27.6s): healthy/denied/no-op saves, bag boundary/existing-ID cases, photo lifecycle.
- Frontend: 667 passed; types, static build, export, archive all exit 0.
- Export: 72 pages, 4399 internal links, 40 images, one H1, no public archive.
- Archive: 67 archived and 41 unchanged business files verified.
- Fresh npm ci; @sonoran/storefront junction points to this exact candidate.
- Owned native 30404 and aggregate 21740 closed; port 4286 released.

Explicit rejected saves preserve exact saved storage bytes. Reload and bag updates retain the existing persistence effect, which refreshes expiry metadata; those tests assert exact saved collection values and ID order, not unchanged envelope timestamps. No retention workaround was added.

Screenshots are supporting functional captures, not full visual/WCAG/manual assistive-technology certification. The maintained full browser suite, backend/runtime API and real commerce were not exercised. No public action or model call.
