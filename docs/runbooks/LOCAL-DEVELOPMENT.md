# Local development — no cloud required

Use Node 22 (see `.nvmrc`) and Python 3.12. Tests may run on newer compatible Node versions; production runtime remains pinned.
Clone the repo and work on your lane's feature branch. Never reuse an unrelated project's virtual environment.

```bash
npm ci
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.lock
python3 scripts/verify_archive.py
python -m scripts.export_contracts --check
python -m pytest
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Run separately while developing:

```bash
npm run dev
python -m uvicorn services.commerce.app.main:app --host 127.0.0.1 --port 8187
python -m uvicorn services.assistant.app.main:app --host 127.0.0.1 --port 8188
```

Frontend: http://localhost:3000. Commerce: http://127.0.0.1:8187/docs. Assistant: http://127.0.0.1:8188/docs.
Use Ctrl-C in each terminal to stop only that process. Playwright owns its port-3137 test server and cleans it up.
Do not reuse an existing server during automated tests; port conflicts must fail instead of testing an unknown app.

## Containers (requires a working Docker daemon)

`docker compose up --build` starts three local-only services. `docker compose down` stops this Compose project.
No cloud keys, remote databases, live processor or sending service are used. /ready intentionally returns 503.
The frontend currently reads the shared reference fixture, not the commerce HTTP API; durable integration is future work.
Do not report a Docker build as passed merely because a Dockerfile exists; see actual verification evidence.

## Updating dependencies/contracts

Runtime Python requirements are pinned in `requirements.lock`; the full dev environment is `requirements-dev.lock`.
After approved upgrades regenerate locks in a clean virtual environment, audit, test and commit the resulting diff.
After API edits run `python -m scripts.export_contracts` and review both the source and generated JSON.
No command in this runbook applies Terraform, publishes a production site, changes DNS or sends customer messages.
