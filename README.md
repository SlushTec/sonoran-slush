# Sonoran Slush — native storefront

Personalized gifts, custom laser engraving, custom/bulk work, and live event experiences from Tucson, Arizona.

## Current delivery

The storefront is implemented across **seven product families and 29 offerings**, with responsive navigation,
search and filters, product-specific personalization, local artwork layouts, saved designs, favorites, a persistent
bag, guest quote requests, bulk/event/contact forms, a gift finder, customer record/proof portals, and a staff workspace.
**Product imagery is intentionally omitted at Brian's request.**

A private static review is published separately from the planned AWS production deployment.
It has no connected customer submission, payment, sign-in, or email service.
Its local designs are real browser drafts; they are not paid orders, inventory reservations, or production proofs.

The commerce source now includes opt-in durable **local** requests, exact-version quote acceptance and proof approval,
an owner workflow, shipment updates, and a **test-mode-only** hosted payment adapter with signed event verification.
Production commerce remains blocked. No AWS resources, domain changes, live charges, customer imports,
or notification campaigns have been activated.

- [Delivery and verification](docs/delivery/STOREFRONT-2026-10-16.md)
- [Private review and local workflow](docs/runbooks/STOREFRONT-REVIEW.md)
- [AWS architecture](docs/architecture/README.md)
- [Production release requirements](docs/requirements/PRODUCTION.md)
- [Preserved business sources](docs/business/SOURCE-REGISTER.md)
- [Pre-native archive](archive/2026-10-14-pre-native/README.md)

## Run the storefront

```bash
npm ci
npm run dev
```

The approved architecture remains Next.js/TypeScript on Amplify with a FastAPI commerce boundary on ECS,
and managed AWS identity, storage, data, notifications, and optional AI integrations.
The local SQLite adapter is for private development, not a replacement production architecture.
The gift finder works from the catalog without a model; live AI is still disconnected.

## Verify

```bash
npm run typecheck
npm run test:frontend
npm run build:review
npm run check:review
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.lock
.venv/bin/python -m pytest -q
.venv/bin/python scripts/verify_archive.py
```

`npm run build` retains the AWS-targeted standalone server build.
`npm run build:review` generates the private static review.
Browser end-to-end tests are maintained in CI; local DOM tests do not establish real-browser or device qualification.

See `AGENTS.md` before editing. The original 67-file archive and 41 retained business documents stay unchanged.
