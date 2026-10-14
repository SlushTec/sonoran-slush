# Deployment and rollback — not yet executable

This reset provisions nothing. CI verifies source, contracts, preservation, browser routes and container builds.
It has no AWS credentials, deployment role or live deployment job. Amplify's YAML is a build specification,
not evidence of a connected application. Terraform currently validates layout contracts only.

AGENT-04 must implement separate dev/staging/production accounts or approved resource boundaries,
reviewed cost estimates, scoped GitHub OIDC, immutable image delivery, backend state/bootstrap and actual modules.
Staging must use synthetic customers, test-mode payments and a mail sink. Real customer uploads are forbidden there.

Before launch, complete `infra/releases/production-gates.json` through reviewed changes with evidence.
Do not flip a flag or remove scaffold guards to claim production readiness. Test domain/payment/mail/webhook
configuration, private access, stock, proof gating, failure recovery, budgets and alerts as an integrated system.

Rollback must restore an earlier verified application release without discarding paid orders, approvals or private artwork.
Schema migrations need an explicit backwards-compatibility/roll-forward strategy. Preserve durable data and reconcile
payment-provider state before resuming fulfillment. Never run unreviewed `terraform destroy` on production.
No general teardown command is supplied until resource ownership and backup protections are implemented.
