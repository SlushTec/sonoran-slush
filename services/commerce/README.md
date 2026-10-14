# Commerce lane — AGENT-02

Start from root: `python -m uvicorn services.commerce.app.main:app --host 127.0.0.1 --port 8187`.
`/health` proves the local process only. `/ready` is intentionally 503.
`/v1/catalog` and product lookup/search read sanitized reference data; all mutation/customer-record paths fail closed.
Swagger/OpenAPI is local developer documentation, not a production security boundary.

Implement durable adapters and authorization before replacing 503 responses. Shared contracts are generated from code.
Future modules: catalog/pricing/configurations, cart, payments/webhooks, inventory, quotes, events,
artwork/proofs, production, fulfillment/refunds, notification outbox and audit. Keep this a modular application
until a demonstrated scaling/security reason warrants a separate service.
