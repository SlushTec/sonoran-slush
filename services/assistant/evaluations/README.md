# Evaluation datasets

No customer data or fabricated benchmark results are included.
Add versioned, rights-cleared scenarios with provenance, expected eligible products/actions, confidence limits,
privacy/injection cases, timeout/budget failures and comparison against deterministic search/filtering.
Never ingest `archive/`, supplier costs, internal business notes or private artwork as public retrieval material.

## RPG-133 disabled-boundary regression slice (2026-11-12)

`tests/contracts/fixtures/assistant-disabled-v1.json` is an original, versioned synthetic corpus. It exercises injection, wrong-order requests, tool abuse, unsupported 360 claims, private input, unbounded retries, human handoff and normal gift discovery against the **disabled** service. It contains no customer information.

The matching contract tests require a static 503 refusal without input echo, false retryability, no-store headers, fresh request IDs, no outbound socket or subprocess use during handling, and no captured input logging. Invalid body values and field names must not leak through 422 responses. Repeated assistant refusals leave the public catalog unchanged and the assistant unready.

A red test demonstrated that validation error locations could echo an attacker-controlled extra-field name. The common handler now gives a static correction message rather than copying locations into responses. Validation status/code and schemas are unchanged. This deliberately trades field-name detail for safe error output; the UI retains its own field-specific validation.

This is not model accuracy, retrieval safety, enabled tool security, cost/latency, persistence audit or production acceptance. No provider is activated. SS-019 remains open until the enabled contracts and owner-approved thresholds exist.
