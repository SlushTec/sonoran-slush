# Southwest branding and product photography — October 17, 2026

Brian requested crystal products separated by shape, size options within each shape, stock product imagery with supplier links, and a Southwest font refresh based on his supplied logo.

## Result

- 13 photo-crystal shape products; 41 catalog listings total. Each shape has its own size selector, a shape-change link, source-backed dimensions, and API validation. Larger unsupported sizes remain excluded.
- The legacy crystal-collection bookmark opens a shape chooser. Recognized saved designs, bag items, and autosaved crystal drafts migrate to their shape routes without discarding personalization. Existing new-route drafts are preserved.
- 40 self-hosted, optimized photo references with alt text, dimensions, and image/source hashes. Source examples are labeled and do not appear as studio-made customer work. The balsa-earring photo is held because the candidate material and painted finish cannot be verified.
- All 41 items have a source-register entry, with documented brands/products distinguished from newly found candidate suppliers. No wholesale prices or supplier stock counts enter the storefront.
- Original coyote, roadrunner, saguaro, and landscape preserved. Logo lettering is redrawn in Rye; Bitter headings and Source Sans 3 body copy are self-hosted with OFL license files. Pine, canyon, and sandstone colors carry the identity through the site.
- The prior ambiguous browser locator and gift-finder ARIA issue are corrected in source. Independent browser and peer qualification are still tracked separately.

## Verification

59 Python tests and 17 frontend DOM tests passed, including unsupported/cross-shape rejection and legacy-design preservation. TypeScript, standalone compilation, and static export passed. Archive checks confirm 67 historical files and 41 retained business documents unchanged. The source-image registry's 40 local asset hashes match their published source counterparts. All 72 review routes and 4,402 internal links passed the export checker; 27 active-document links passed. Final publication details are recorded separately after packaging.

No live accounts, payments, email, private uploads, AI service, AWS provisioning, or public audience change is part of this update. The existing owner-private review remains the delivery target.

## Evidence

- [Supplier and photo register](../assets/SUPPLIER-AND-PHOTO-REGISTER.md)
- [Photo provenance and hashes](../assets/product-sources.json)
- [Brand notes and original supplied logo](../brand/README.md)
- [Machine-readable verification](SOUTHWEST-2026-10-17.json)
- [Previous private deployment receipt](PRIVATE_REVIEW.json)

Rollback: redeploy the prior private Site version or revert this feature change. Do not overwrite private order data as part of a visual rollback. Implementer review performed; independent reviewer unassigned.
