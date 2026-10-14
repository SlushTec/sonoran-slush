# AWS-native architecture — foundation decision record

Status: selected scaffold direction, integrations not provisioned or production-qualified.
Owner's target is a full polished production service, not a class demo or a crystal-only shop.

## Decisions for the scaffold

| Boundary | Direction | Why / current status |
| --- | --- | --- |
| Storefront | Next.js App Router + TypeScript; Amplify Hosting target | Server-rendered/product-search-ready foundation; reference routes only |
| Commerce | Modular FastAPI application; ECS/Fargate target | One authoritative catalog/pricing/order/quote/event/proof domain, not a microservice per button |
| Assistant | Separate FastAPI boundary; Bedrock tool calling later | Optional, failure-isolated, disabled by default |
| Identity | Cognito customer/staff identities | Authorization and order ownership must still be enforced in commerce |
| Records | DynamoDB planned | Access patterns, transactions, stock reservations and webhook idempotency require design/tests |
| Files | Separate public product assets and private S3 uploads/proofs | Authorization before short-lived links; validation/quarantine/retention work pending |
| Notifications | SES + durable outbox/queue | Receipts, proof requests, event/bulk status; production sending approval pending |
| Payments | Hosted processor checkout, Stripe adapter proposed | Card details never traverse our app; no SDK/live keys in this foundation |
| Operations | CloudWatch, Secrets Manager, scoped IAM, Terraform | Metrics/alerts/restore/budget work not yet implemented |
| Development | Four lanes, branch/PR review, automated verification | No agents activated by this reset |

The storefront initially consumes a reference catalog; the commerce service exposes the same fixture read-only.
This is temporary scaffold data, not durable commerce. No frontend-to-payment flow exists yet.

Target flow:
Customer -> Amplify storefront -> authenticated/authorized commerce API on ECS -> managed records/files/notifications.
Optional assistant -> narrowly scoped commerce tools -> verified business results; never direct mutation of payment/production state.
Hosted processor -> signed webhook -> idempotent payment record -> independently gated fulfillment workflow.

## Deliberate non-decisions

No Kubernetes, required SageMaker endpoint count, trained recommendation model, fixed five-week deadline,
merchant payment approval, shipping/tax policy, region/account or DNS cutover is inferred from the capstone conversation.
`us-east-1` is only a configurable starting value, not proof of account/model availability.
Next.js 15's current patched release is used because AWS currently documents native SSR support through 15.
Do not jump major versions without verifying the host, dependencies and security advisories.

## Integration sequencing

1. Approve normalized catalog/policies and shared domain contracts.
2. Make one durable product -> configuration -> order -> verified payment -> versioned proof path work.
3. Extend the same domain to other products, quotations and events; validate each path.
4. Add helpful AI and operational safeguards without making commerce depend on inference.
5. Pass all production gates, then request live deployment/cutover approval.

## Primary technical references checked 2026-10-14

- Amplify Next.js support: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
- ECS/Fargate responsibilities: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
- Terraform S3-native locking: https://developer.hashicorp.com/terraform/language/backend/s3
- Payment fulfillment: https://docs.stripe.com/checkout/fulfillment
- Bedrock tool use: https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
