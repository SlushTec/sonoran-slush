# Storefront lane — AGENT-01

Next.js App Router, React and TypeScript. Local routes, product-family navigation and simple reference search are real.
Everything transactional is explicitly disabled. Product photography placeholders are labeled; no synthetic reviews,
prices, stock, production promises, authentication or successful orders are fabricated.

Use `npm ci`, `npm run dev`, `npm run build`, `npm run typecheck` at the repository root.
The shared reference fixture sits in `packages/contracts/`; do not create a competing product data source.
No-index headers and robots apply to the entire scaffold. This is not authentication: do not deploy private data.
`SONORAN_STAGE` values other than `scaffold` deliberately fail closed until release gating is implemented.
Production data adapters, authentication, nonce-based CSP, SEO/sitemaps, imagery and all commerce flows remain backlog work.
