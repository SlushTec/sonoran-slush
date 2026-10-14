# Sonoran Slush — native commerce platform

Personalized gifts, custom engraving, bulk work and live event experiences.
This is our own production-targeted build, developed across four work-agent lanes. It is not a class project.

## Current status

**Rescaffolded foundation; NOT a production-ready store.** The storefront route skeleton, reference catalog,
read-only commerce API, disabled assistant boundary, contract tests, CI and AWS infrastructure layout are present.
Payments, accounts, uploads, quotations, booking, proof approval, fulfillment and live AI remain release-gated.
No AWS resources have been provisioned and no domain, checkout or customer data has been migrated by this reset.

## Start here

- [Current architecture](docs/architecture/README.md)
- [Production requirements and release gates](docs/requirements/PRODUCTION.md)
- [Customer experience specification](docs/requirements/CUSTOMER-EXPERIENCE.md)
- [Four work-agent lanes](docs/delivery/WORKSTREAMS.md)
- [Machine-readable backlog](docs/delivery/backlog.json)
- [Business sources and unresolved decisions](docs/business/SOURCE-REGISTER.md)
- [Local development](docs/runbooks/LOCAL-DEVELOPMENT.md)
- [Archive and preservation manifest](archive/2026-10-14-pre-native/README.md)

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/storefront/` | Next.js/TypeScript customer routes and owner-area shell |
| `services/commerce/` | FastAPI catalog/domain boundary; future authoritative order workflows |
| `services/assistant/` | Separate, optional AI boundary; no payment or fulfillment authority |
| `packages/contracts/` | Shared reference catalog, API contract and domain schemas |
| `infra/terraform/` | Environment/module contracts for Amplify, ECS/Fargate and managed AWS services |
| `tests/`, `scripts/` | Unit/contract/browser/preservation checks |
| `docs/` | Current engineering specifications plus preserved business references |
| `archive/` | Immutable pre-native snapshot, excluded from application builds |

## Local preview

```bash
npm ci
npm run dev --workspace @sonoran/storefront
# http://localhost:3000 — non-transactional scaffold, no live integrations
```

Use the local-development runbook for Python services and the full verification suite.
Do not publish the reference catalog as purchasable stock: prices, availability and product photography require approval.

## Platform direction

Custom storefront on AWS Amplify Hosting; containerized commerce and optional AI on ECS/Fargate.
Managed Cognito, DynamoDB, private S3, SES, Secrets Manager and CloudWatch are planned integrations.
A hosted payment provider collects card details; Sonoran Slush owns prices, orders, proofs and fulfillment state.
Bedrock assistance is optional and cannot change commercial rules. Kubernetes and custom model training are not requirements.

See `AGENTS.md` before editing. Existing Shopify mentions in preserved business sources are historical context,
not current platform decisions. The archive is recoverable; it must never become a public route or AI knowledge source.
