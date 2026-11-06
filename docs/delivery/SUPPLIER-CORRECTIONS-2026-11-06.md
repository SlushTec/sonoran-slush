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

These are current author-run checks. Prior PR receipts are historical. Parent independently read the complete initial patch at `917c3a14e90f7dd818855e4227e6783799c76b46` and reported no blocking implementation/source-handling defect; final updated bytes still need parent review. Physical-device QA, screen-reader qualification, field performance and production acceptance are not claimed.

Following parent review, corrected sentence-case “photo crystals” in metadata and FAQ, preserving title-case category labels. Official Playwright Chromium installation succeeded with `PLAYWRIGHT_BROWSERS_PATH=/tmp/sonoran-playwright-browsers npx playwright install chromium`: Chrome for Testing and Headless Shell 156.0.8078.4 (revision 1248), plus Playwright FFmpeg. No custom mirror, credentials or security/network changes. `npm run build` produced the standalone application successfully. The initial existing E2E suite passed all 32 tests in 54.2 seconds, but emitted `NoFallbackError` logs while the standalone preview lacked copied public assets. The existing preview script copies `.next/static` but not `public`; no preview-script source change was made. Copied unchanged `apps/storefront/public` into the generated standalone app for a second complete E2E run. The complete-preview rerun passed 32/32. After restoring an accidentally lowercased care heading, rebuilt both review and standalone outputs from the final implementation bytes and ran the complete browser suite again: **32 passed, 0 failed, 0 skipped**, in about 1.1 minutes. Public assets were copied only into generated output; source asset bytes are unchanged. Remaining `NoFallbackError` logs accompany deliberate invalid-product/archive 404 probes, whose assertions pass.

Final browser coverage: 23 page route/accessibility checks using WCAG-tagged axe rules; all 7 category and 41 product routes plus invalid/archive 404 checks; search/recovery; mobile navigation and Escape/focus behavior; personalized bag persistence with request-only checkout; overflow checks at 320, 390, 768 and 1440 px across six routes; closed readiness/noindex checks. This is automated Chromium coverage, not physical-device or screen-reader qualification. Final review export still passes 72 routes and 4,402 internal links. Final DOM suite passes all 21 tests. No browser regression or runtime/download denial occurred.

Final browser JSON evidence is local at `artifacts/playwright-results.json`, SHA-256 `2b99ef2d12759b1c216ee434a1213a4bd44f0e034bd5bea27854d86939d33de9`; browser stdout is `/tmp/sonoran-e2e.log`. These generated logs are not committed or included as source changes.

## Operations and limits

Created an isolated local clone/branch; original checkout and intake checkout/artifacts remain untouched. Installed locked npm and Python development dependencies for the authorized implementation checks. Initial npm install failed with EROFS on the default cache; retry with `/tmp/sonoran-product-npm-cache` passed. Initial new DOM provenance assertion incorrectly rejected the ordinary word “wholesale”; narrowed it to private metadata fields and reran all 21 tests successfully. Neither was an approval denial.

Supplier pages were checked through web retrieval on 2026-11-06; cached content is possible. eBay salt-rimmer URL could not be retrieved. Exact blanks, availability, disputed measurements, final packages, selling-price approval and public image rights remain open. No supplier stock counts, costs, expanded size options or new images were imported. No prices, taxes, discounts, fulfillment promises, production gates or customer/payment data were changed.

No push, merge, deployment, Linear changes, schedules, workers, credentials, paid resources or external notification. Parent coordinates final independent review of the local commit and complete patch. The same private Library patch item is updated for transfer, without repository publication. The earlier intake documents remain untracked and unchanged in `/workspace/sonoran-studio-intake/docs/delivery/`.
