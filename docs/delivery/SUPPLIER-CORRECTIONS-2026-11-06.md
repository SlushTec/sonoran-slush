# Supplier product-page corrections — 2026-11-06

Authorization: owner requested “use the supplier links to fix the product pages.” Local implementation only, based on PR #3 `19c2b2c53189d896ccbee1a37cd843f4fad42e01` (remote head reconciled unchanged), stacked on #2 `3560719b2cb0997832ff808cb8a457a67d51d9d8` and #1 `52680c2e0e8647f78e41c5a93b273b0fd1d681a2`. Branch: `fix/supplier-product-pages-20261106`; checkout: `/workspace/sonoran-product-corrections`.

## Changes

All 41 listings have a safe display-only supplier-reference record and visible match qualification. The original provenance register remains unchanged: 14 documented shapes/bases, 6 documented products, 3 brand references with unverified exact blanks, 17 candidates, 1 held earring concept. See [the dated listing audit](../assets/SUPPLIER-AUDIT-2026-11-06.md) for each URL, retrieval limitation, finding and action.

Corrected product-specific care; retained journal refillability while qualifying conflicting widths; added supported MakerFlo/Libbey dimensions and handle/package caveats; distinguished 1639HT supplier reference from actual blank. Qualified unmatched shot-glass/decanter capacities and gift-kit contents. Removed unverified lead-free assertion. Kept RFID performance, pendant fittings and balsa material/finish unverified. Held earring photo remains absent. Heart surface-ornament caption now includes final-blank qualification.

Shared category is “Photo crystals” because three shapes use 2D subsurface engraving. Surface ornaments remain separate. Small Notched and round 2D ornament display supplier dimensions while preserving original saved request values. All 13 shape slugs, request values, orientations and processes are unchanged; supplier larger sizes were not added.

## Current verification on final implementation bytes

- `npm run typecheck`: passed.
- `npm run test:frontend`: 21 passed (17 existing + 4 regression tests).
- `.venv/bin/python -m pytest -q`: 59 passed; existing Starlette/httpx deprecation warning, no failures.
- `npm run build:review`: passed, final display references included.
- `npm run check:review`: passed; 72 routes, 7 categories, 41 products, 4,402 internal links, 40 self-hosted product images, one H1/page, archive excluded.
- `.venv/bin/python scripts/verify_archive.py`: passed; 67 archived files and 41 retained business files unchanged.
- `.venv/bin/python scripts/check_links.py`: passed; 29 active-document links including this receipt.
- `.venv/bin/python -m scripts.export_contracts --check`: passed.
- `git diff --check`: passed.
- Direct baseline comparison: all 13 shape slugs/size request values/orientations/processes unchanged; all 41 catalog records retain reference status, null prices and non-purchasable state. Production gates unchanged.

These are current author-run checks. Prior PR receipts are historical, and no independent review or production acceptance is claimed. Browser E2E, device QA, screen-reader qualification and field performance were not run: Playwright Chromium executable `/home/agent/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` is absent. No browser download was attempted.

## Operations and limits

Created an isolated local clone/branch; original checkout and intake checkout/artifacts remain untouched. Installed locked npm and Python development dependencies for the authorized implementation checks. Initial npm install failed with EROFS on the default cache; retry with `/tmp/sonoran-product-npm-cache` passed. Initial new DOM provenance assertion incorrectly rejected the ordinary word “wholesale”; narrowed it to private metadata fields and reran all 21 tests successfully. Neither was an approval denial.

Supplier pages were checked through web retrieval on 2026-11-06; cached content is possible. eBay salt-rimmer URL could not be retrieved. Exact blanks, availability, disputed measurements, final packages, selling-price approval and public image rights remain open. No supplier stock counts, costs, expanded size options or new images were imported. No prices, taxes, discounts, fulfillment promises, production gates or customer/payment data were changed.

No push, merge, deployment, Linear changes, schedules, workers, credentials, paid resources or external notification. Parent coordinates independent review of the local commit and complete patch. The earlier intake documents remain untracked and unchanged in `/workspace/sonoran-studio-intake/docs/delivery/`.
