# AI lane — AGENT-03

Start from root: `python -m uvicorn services.assistant.app.main:app --host 127.0.0.1 --port 8188`.
The assistant is disabled. Valid requests get 503 ASSISTANT_DISABLED; no input is persisted and no model is invoked.
Bedrock integration must be explicitly configured and evaluated later. No custom training or SageMaker endpoint quota is required.

Tool contracts must expose only approved public catalog data and authorized customer context. No direct database writes,
price invention, stock/date commitments, card data, refunds, production approval or arbitrary shell/network tools.
Budget token usage, retries and tool steps. Add injection/privacy/failure tests and deterministic fallbacks before activation.
The store must function normally without AI; this service must never gate normal checkout readiness.
