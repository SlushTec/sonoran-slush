# Customer storefront

Next.js App Router and TypeScript. Navy/gold, image-free presentation across the full documented catalog.

- All seven collections and 29 product routes, with product-specific design options.
- Search, material/occasion filters, favorites, and a catalog-based gift finder.
- Names, inscriptions, font layouts, supported crystal shapes/sizes, and local photo/logo layout controls.
- Device-local drafts and bag, explicit 30-day retention, download and clear controls.
- Guest pricing requests, custom/bulk inquiries, live-event inquiries, and contact forms.
- Private reference/access-code portals for quotes, orders, and exact-version proof decisions.
- Authorized staff workspace for reviewed quotes, order/proof preparation, production checks, and dispatch.
- Help, care, artwork guidance, privacy behavior, ordering guidance, and accessibility information.

## Modes

`npm run dev` from the repository starts local development.
`npm run build` creates a standalone Next.js build for the AWS hosting direction.
`npm run build:review` creates an image-free static review in `out/`.

Without `NEXT_PUBLIC_COMMERCE_API_URL`, no request details are sent.
Draft downloads and local customization still work; unavailable service actions produce recoverable errors.
No successful checkout, sign-in, or artwork upload is simulated.

The local artwork layout is not a production proof. Original file bytes and local crop adjustments are not persisted.
Pricing, stock, shipping, tax, and timing are never supplied by client fixtures.
