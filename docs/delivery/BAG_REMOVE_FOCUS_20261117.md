# Private bag removal keyboard recovery
Baseline 1869c13f8eb7360fb3ab293dc135b967b6d6d683. Existing keyboard-accessible shopping scope; no business, pricing, persistence, or removal contract changes.

Removing a focused bag row detached the active button and lost keyboard position. The explicit Remove action now focuses the next row's Remove button, the prior final row when removing the last row, or the empty bag's Find their gift link. No initial-mount, reload, or quantity-change focus transfer. Existing removeCart performs the unchanged mutation.

Evidence outside checkout: D:\dot-workspace\store-remove-*.log/.exit.
- Baseline native red: first 1280 case failed next remaining button focus; second case not run (max failures 1).
- Final native: 2 passed, 12.3 seconds, 1280/390; middle/last/final repeated keyboard removal, exact remaining row data, reload persistence and no initial focus steal, empty reload and no horizontal overflow.
- Frontend 658 passed; TypeScript, static build, export, archive verification all exit 0.
- Export: 72 pages, 4399 links, 40 images, one H1/page, no public archive. Archive: 67 files and 41 unchanged business files.
- Fresh npm ci; @sonoran/storefront junction resolves to this candidate/apps/storefront. Native harness is untracked, port 4259, reuseExistingServer false.
No full browser suite, manual assistive-technology, screenshots, physical phone, real commerce or public release claim. Independent review required.
