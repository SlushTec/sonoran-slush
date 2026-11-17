# Catalog recovery keyboard focus

Private bounded RPG-117 / SS-007.AC3 repair, based on category-state candidate 43624a9587c88b274b540f29bc3cfaa7e8219eaf. No publication or full requirement acceptance.

Clear search, Reset filters and empty-state Clear filters could remove their focused button and leave focus on the document body. All three actions now explicitly return focus to the existing search input, allowing immediate typing and predictable onward keyboard navigation. No automatic focus is added on mount, restoration or typing; filter, sort and URL behavior is unchanged.

Evidence: three new DOM regressions failed before the repair and passed afterward. Native Edge tests at 1280 and 390 widths cover repeated Enter recovery, Space activation, no-result removal, category preservation on search clearing, reload, sort and unrelated query/fragment preservation. These are automated desktop-browser viewports, not physical-phone or screen-reader qualification.

The first red attempt was stopped because DOM equality assertion diagnostics were excessively expensive; a boolean identity assertion preserved the same criterion and produced the three expected failures. The first native attempt began typing before initial URL sort restoration; the test now waits for the requested sort value before interacting. Its failed log is retained; assertions were not weakened.

Full card acceptance, image/claim/scale approvals, real assistive-technology testing and held guided design/rollup/packaging remain outside this slice. No business data, pricing, backend, payment, provider, or production changes.

The Windows build-review npm.cmd wrapper returned exit 1 without producing an export; the dependent first export check consequently failed for missing routes. Verification uses the unchanged maintained build-storefront.mjs entrypoint directly from the workspace with SONORAN_REVIEW_EXPORT=1 and NEXT_TELEMETRY_DISABLED=1. No wrapper or dependency change belongs to this feature.
