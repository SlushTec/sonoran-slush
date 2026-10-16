# Storefront review and local request workflows

## Private review

The review uses the same Next.js source, exported as static pages.
Its commerce origin and customer sign-in URL are unset, so it cannot submit personal details or collect payment.
It keeps saved design text, options, favorites, and a bag in browser local storage for up to 30 days.
Inquiry details are saved only when the visitor explicitly chooses Save draft.
Original artwork remains in browser memory and is never included in saved drafts or telemetry.

```bash
npm ci
npm run build:review
npm run check:review
```

The deployment contains the exported pages, CSS, and scripts. It excludes the Git archive, business documentation,
local databases, environment files, and the server's API process/readiness files.
Static review hosting is separate from the planned Amplify/ECS production deployment.
Final product images are deliberately absent.

## Local integration

Use a private development machine, synthetic records, and secrets kept outside Git.
The default `SONORAN_STAGE=scaffold` remains in force; other deployment stages are refused.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.lock
```

Set environment variables in the shell that will run commerce:

- `SONORAN_REQUESTS_ENABLED=true`
- `SONORAN_ACCESS_SECRET`: a persistent random secret of at least 32 characters
- `SONORAN_STAFF_TOKEN`: a distinct random staff token of at least 32 characters
- `SONORAN_DB_PATH`: a private absolute SQLite path outside source control
- `SONORAN_ALLOWED_ORIGINS`: the exact storefront origin

Then run `.venv/bin/python -m uvicorn services.commerce.app.main:app --host 127.0.0.1 --port 8187`.
Run the storefront with `NEXT_PUBLIC_COMMERCE_API_URL=http://127.0.0.1:8187 npm run dev`.
Browser-visible environment values are build-time inputs; never put secrets in a `NEXT_PUBLIC_` variable.

The service stores records transactionally and hashes access codes.
The master access secret must remain stable with the database. A mismatched secret fails closed instead of
silently changing existing record credentials. Back up and restore the private database and secret together;
a production-grade backup/restore drill has not been qualified in this delivery.

The existing default Docker Compose profile still leaves workflows disabled.
To enable a containerized request service later, provide a persistent writable private data volume and runtime
secrets deliberately; the read-only default profile must not be mistaken for durable application storage.

## Local workflow

1. Submit a synthetic retail, bulk, or event inquiry and download the private receipt.
2. In `/admin`, open the staff workspace and load the request.
3. Prepare a reviewed quote with the complete total and terms. This creates a new version.
4. In `/quotes`, use the guest receipt code to accept that exact current version.
5. For retail/bulk, staff can prepare an unpaid order and download its separate receipt.
6. Staff prepares an exact-version text proof. The proof gets a separate guest receipt.
7. Customer approves that version or requests changes. A new proof revision clears prior approval.
8. Verified payment, the current proof approval, reserved blanks, and capacity are required before production.
9. Staff records dispatch only after production release.

Events remain inquiries/proposals. This delivery does not turn an inquiry or accepted proposal into a confirmed event,
reserve dates, set deposits, or assert machine throughput.

## Payment adapter

The adapter accepts only test-mode configuration, never live keys or live events.
Set `SONORAN_TEST_PAYMENTS_ENABLED=true`, a Stripe test secret, a test webhook signing secret,
and the HTTPS storefront return origin in the local service environment to exercise the adapter separately.

The private review does not set these variables. Local tests use a mocked processor, synthetic signatures,
and synthetic order records; **no real Stripe API call or payment was made**.

Signed events, rather than a browser return URL, establish payment status.
Payment verification does not automatically release production.
Provider integration testing, live authorization, taxes, shipping, refunds, reconciliation operations,
and the production payment review remain release gates.

Technical reference: [Stripe Checkout sessions](https://docs.stripe.com/api/checkout/sessions/create)
and [Stripe webhook verification](https://docs.stripe.com/webhooks/signature).

## Verification boundaries

`npm run test:frontend` uses a DOM implementation, not a browser.
Its accessibility check omits color-contrast evaluation; core text colors were checked numerically against their
declared backgrounds, which does not establish whole-page conformance.

Browser tests remain in `tests/e2e/foundation.spec.ts` and CI.
No browser, screen-reader, mobile-device, load, or field performance claim follows from DOM checks.

The [Sites workflow](skill://sites@openai-curated-remote/root/.codex/plugins/cache/openai-curated-remote/sites/1.0.2-remix-a.1/skills/sites/SKILL.md)
directs: “If `$control-browser` is unavailable, skip browser QA: do not start a preview server, install a browser,
or improvise another browser-control path.” That capability is unavailable in this session; no browser or preview server was started.

## Rollback

Revert the storefront feature commit to return to the October 14 foundation, or redeploy the prior private Site version.
This does not delete local request records or restore a private database.
Never overwrite a newer database with the historical source archive.
