# AWS infrastructure scaffold — AGENT-04

**Layout and validated environment contracts only. No AWS resources are defined or provisioned yet.**
This is intentionally not a pretend working deployment. The implementation tasks are tracked in OPS-01/02/03/04.
Do not call a successful `terraform validate` proof that the target architecture is deployed.

- `environments/dev`, `staging`, `production`: separate future state and environment parameters.
- `modules/environment-contract`: validates environment labels and a permanently-disabled live-commerce flag.
- Other module folders define responsibilities/inputs/outputs to implement, not fake resource identifiers.
- `backend.hcl.example`: fill approved state settings after state bootstrap; S3 native locking/versioning required.
- No AWS provider, credentials or default account lookup occurs in the current environment skeleton.

Verify locally without AWS credentials:

```bash
terraform fmt -check -recursive infra/terraform
for env in dev staging production; do
  terraform -chdir=infra/terraform/environments/$env init -backend=false
  terraform -chdir=infra/terraform/environments/$env validate
done
```

Before provisioning: obtain owner approval for account/region/budget, review a real resource plan,
use narrowly scoped OIDC/roles, and verify backup/teardown protections. Separate public assets from private artwork,
and keep customer/staff permissions separate. No Terraform apply is authorized by this reset.
Production requires an independently reviewed change to the gates and real application acceptance evidence.
