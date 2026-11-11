# Private proof review portal

This public-source UI consumes the existing local proof evidence API. It does not activate production,
payments, providers or manufacturing. Orders and quote portal code, including its existing payment URL
guard, is unchanged. A hook-free dispatcher selects the new proof component.

## Review behavior

- A current proof must match its exact bound revision before approval controls appear.
- Past versions are read only, even if the selected history entry happens to be the current version.
- Returning to current fetches the current record and evidence again; confirmation and comment reset.
- A legacy unbound proof remains readable, but needs a fresh studio revision before approval.
- The page shows exact wording, recorded configuration, second inscription, font and piece mapping.
  It does not claim that historical image bytes or export files have been preserved.
- History requests fetch at most 25 metadata rows, and only one explicitly selected material context.
  Configuration items, inscriptions and decisions have bounded rendering pages.
- Approval is distinct from payment, stock, capacity and production readiness.

## Private session lifecycle

Credentials are held only in component/ref memory, tied to the loaded record and request generation.
Closing, editing credentials, leaving/unmounting, browser Back and restored BFCache invalidate pending
lookup, history and action responses. Ordinary initial pageshow does not erase typed input.
A synchronous operation lock prevents duplicate mutation clicks. An uncertain/failed mutation disables
approval until current evidence is refreshed. Ignoring a late response does not imply server cancellation.

Only bounded typed response fields are rendered. Code-point limits preserve valid supplementary Unicode
while rejecting lone surrogates and oversized malformed fields; text is never interpreted as HTML.
No credentials enter URL parameters, local storage, analytics or screenshots as plaintext.

## Reproducible local QA

Install the existing lockfile once with npm ci. The routine test:frontend command includes both Node test
files. The storefront CI job alone builds with NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid.
Browser tests intercept that reserved invalid host; application code has no test fallback or special branch.

Run npm run test:frontend, npm run build, npm run typecheck and npm run test:e2e with that test-only build
origin. On the native Windows npm 10 / Node 24 installation, nested npm scripts may fail before launching
their child with a stdin error. Equivalent direct commands used for verification are:

- node --test tests/frontend/storefront.test.cjs tests/frontend/proof-review.test.cjs
- node node_modules/typescript/bin/tsc --noEmit -p apps/storefront/tsconfig.json
- From apps/storefront: node ../../scripts/build-storefront.mjs
- Playwright with the same tests/settings and a local config whose owned preview command is
  node scripts/preview-storefront.mjs --hostname 127.0.0.1 --port 3137

The standalone preview now copies repository-tracked public assets into its owned output. This fixes
broken logo images observed during actual screenshot inspection. HTTP content hashes and loaded-image
checks cover the repair; no untracked/customer assets are copied.

### Real backend smoke (separate from mock tests)

Set PROOF_SMOKE_PYTHON to the existing locked interpreter and PROOF_SMOKE_TEMP to a short directory in
the authorized work folder, then run node tests/frontend/proof-real-smoke.cjs after the test-origin build.
It starts hidden owned loopback ASGI/preview processes, seeds synthetic stock/offer/cart/order/proof via
supported APIs, and uses a headless browser with a test-runner-only relay to the real backend.
It checks an actual persisted approval, immutable historical revision after a new revision, historical
read-only UI and private Close. It uses no payment connection or actual customer data.
Finally it closes its browser/process trees, verifies owned ports closed and removes only its validated
self-created temporary database directory. Screenshots are preserved outside that temporary directory.

This is partial customer proof-review acceptance, not live-store or manufacturing qualification.
