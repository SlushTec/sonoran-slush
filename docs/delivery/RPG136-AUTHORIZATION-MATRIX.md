# RPG-136 / SS-081: synthetic admin authorization matrix

## Scope

This additive test slice inventories the 40 admin method/path pairs at base `340c9bd7f2dbaa4690dcd92cb141cf79cf0c4091`. The committed inventory is compared with actual OpenAPI paths so a new, removed or renamed admin route requires an explicit reviewed inventory update. It is not a claim of production authentication or full OPS-02 completion.

For every inventoried route, tests exercise missing, incorrect, customer-only, non-Bearer, query-string-only and cookie-only credentials. Each request must return the exact non-retryable access-required error and leave every logical SQLite table and schema unchanged. Existing staff summary access succeeds first, preventing a globally unavailable app from producing a false security pass. Response payloads must not echo synthetic credentials. Request paths, method and dispatch run through the real ASGI application; no authorization dependency override is used.

The same routes must return 503 without state mutation with requests disabled, a production-stage value, or a missing access secret, even with the fixture staff token. An additional test rotates only the fixture staff token and verifies that old staff access fails, new staff access succeeds, and the separate customer's access remains intact.

## Verification and limits

Run `python -X utf8 -m pytest tests/unit/test_admin_authorization_matrix.py -q` in the locked project development environment. The expected count is 362 cases: 240 unauthorized requests, 120 disabled-service requests, inventory completeness and fixture rotation. Each request test has its own temporary database.

Bodies are deliberately empty valid JSON: this tests authorization before request-body validation, not the success semantics of every endpoint. Positive staff mutation, cross-customer private paths and their valid payloads remain covered by the existing feature suites, not claimed by this matrix. Runtime implementation, dependencies and settings are unchanged.

No live credentials, real customer data, provider calls, Cognito, signed URLs, browser session expiration, request/access-log redaction, uploads, CSRF or rate-limit acceptance is established here. In particular, query-string credential rejection does not make putting secrets in URLs safe. Production identity, retention and deployment gates remain open. Tests are synthetic and do not authorize activation.

A first author run correctly got 401 but expected FastAPI's raw detail envelope; the harness was corrected to assert this application's existing ProblemResponse envelope instead. No runtime change was needed. Independent frozen-source review and hosted checks are required before integration.
