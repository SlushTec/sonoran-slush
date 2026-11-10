.PHONY: archive test contracts web-check terraform-check
archive:
	python3 scripts/verify_archive.py
contracts:
	python -m scripts.export_contracts --check
test: archive contracts
	python -m pytest -q
web-check:
	npm run build
	npm run typecheck
	npm run test:e2e
terraform-check:
	terraform fmt -check -recursive infra/terraform
	@for e in dev staging production; do terraform -chdir=infra/terraform/environments/$$e init -backend=false && terraform -chdir=infra/terraform/environments/$$e validate || exit 1; done
