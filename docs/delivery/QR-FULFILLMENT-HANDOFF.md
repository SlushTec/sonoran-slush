# Isolated QR mapping and fulfillment preflight

Reviewer requested: AGENT-02 (commerce contract); AGENT-04 owns serial integration.
Peer review and integration are pending. This lane does not modify their existing files.

## Source and limits

Base: public PR #3, `19c2b2c53189d896ccbee1a37cd843f4fad42e01`, verified with
`git ls-remote https://github.com/SlushTec/sonoran-slush.git refs/pull/3/head`.
Isolated checkout: `/workspace/sonoran-qr-isolated`; branch:
`team/qr-fulfillment-validation`. No supplier-corrections work was used.

Read-only GET of the [actual supplier QR page](https://global.3dcrystalglobal.com/store/Sonoran-Slush-3D-Crystal-&-Glass/)
on 2026-11-06 succeeded via curl; web-reader access failed. HTML contains shape
labels and a blank product-id input. That does not confirm supplier variant
identifiers, complete options, exact local-to-supplier mappings, or compatibility.
No supplier HTML, amounts, customer data or credentials are committed.

Coordinator's read-only UI checkpoint reports 18 shape choices and Rectangle
Tall sizes through Mini Mantel. After selecting Small, the next step requires a
photo upload and disables Next. Downstream add-ons/details are unverified.
Those observations are not owner approval to expand local sizes or mappings.
No upload, gate bypass, submission, passcode, order, paid call, live integration,
publication, merge or deployment occurred in this lane.

## Proposed internal interface (not wired)

`plan_fulfillment(Request, Policy, RetailApproval | None, ProductionPrerequisites)`
returns a frozen `Result`. It performs no I/O. Use Pydantic validation at a future
adapter boundary; strict inputs reject coercion and unexpected fields. Do not use
`model_construct` or unvalidated `model_copy(update=...)` for boundary inputs.

- `Choice`: exact product ID plus sorted, unique option-name/value pairs. Case,
  whitespace, missing/extra options and values are never silently translated.
- `Policy`: independently approved exact local choices, mapping records, and
  owner qualifications. Empty by default; **no real mappings are bundled**.
  The caller must derive the allowlist from approved local offerings, never the
  supplier page. Adding a mapping cannot expand the allowlist.
- `Mapping`: ID/revision, exact local and supplier choices, equipment/process,
  confirmation state and evidence reference. Any duplicate matching mapping or
  reused mapping ID is ambiguous. Withdrawn and unconfirmed mappings are held.
- `Qualification`: SHA-256 fingerprint of the entire canonical mapping, explicit
  owner compatibility decision/evidence, and explicit no-curved-Jet-Mini
  attestation. Any mapping revision/choice/process change requires qualification
  again. Names and geometry are never evidence. Unknown/incompatible/missing
  evidence cannot pass. Every choice requires the no-curved attestation, a
  deliberately conservative requirement even for other equipment.
- `RetailApproval`: customer-approved quote ID, current/accepted versions,
  exact selection/quantity, integer minor-unit **unit** price and currency.
  Supplier cost/retail fields are rejected. Price is preserved without arithmetic,
  scraping, currency conversion, tax/shipping calculation or fallback.
- `Result`: `unsupported`, `ambiguous`, `held`, or `ready_for_owner_review`, with
  stable ordered reason codes. Only the last status has a review plan. Every
  result has `execution_authorized=false`; no automatic fulfillment exists.

A future authenticated staff adapter must load policy, customer quote acceptance
and production prerequisites from trusted server records, binding all to the same
order/line and current proof. Evidence references are provenance pointers, **not
signatures or an authorization mechanism**. Never accept policy/qualification/
retail acceptance or gate booleans directly from customer inputs. This standalone
module cannot authenticate the owner or verify those records. Preserve existing
payment, proof, inventory, capacity and production release checks independently;
a successful preflight is not a production release or a supplier order payload.
No existing Item model, route, catalog, contract export, pricing or gate changes.

## Owner decisions required before any populated mapping

Confirm each exact approved local choice against the supplier choice and required
option identifiers, with evidence and revision. Qualify the exact equipment and
process under the no-curved Jet Mini rule. Supply separately approved customer
retail quotes. Resolve photo-gated options through an authorized workflow; do not
invent defaults or treat the partial supplier UI as complete. Define evidence
storage, owner authentication, revocation and order/proof binding in the eventual
adapter. No supplier size expansion is included or authorized by these observations.

## Validation

Dependencies installed into this checkout's ignored `.venv` from the unchanged
`requirements-dev.lock`. Focused command:
`.venv/bin/python -m pytest -q tests/unit/test_qr_fulfillment.py` — 43 passed.
`.venv/bin/python -m pytest -q` — 102 passed; one existing Starlette/httpx
deprecation warning. `.venv/bin/python scripts/verify_archive.py` — 67 archive
files and 41 unchanged business files verified. `git diff --cached --check` — passed. Browser/e2e, frontend typecheck,
frontend build/static-export checks, live services and production stages are not
run by this isolated Python-only lane. Fixtures are synthetic and never approvals.
