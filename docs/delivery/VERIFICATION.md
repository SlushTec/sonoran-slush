# Rescaffold verification — 14 October 2026

Evidence is limited to the foundation, not production commerce. Final measured results are recorded below after rerun.
All tests were performed in the isolated Sonoran Slush worktree on BRIAN-PC under WSL; no unrelated repository was modified.

## Scope

Complete original snapshot and business-source preservation; read-only catalog and blocked service boundaries;
responsive route/navigation/search foundations; generated API contracts; local builds and Terraform layout validation.

## Explicitly not completed

No AWS resources, DNS, real payment, customer import, live email, authentication, durable commerce, live AI,
production performance qualification, human accessibility certification or four-agent activation.
Docker was unavailable from this WSL distro; CI includes container builds/smoke tests and must supply that evidence separately.
Automated accessibility results apply to the current mostly-static scaffold, not future customer flows.
Historical business data still requires owner validation before publication or sale.

## Measured local results

| Check | Result |
| --- | --- |
| Original files archived and verified against Git base | 67 / 67 |
| Business source files retained byte-for-byte | 41 / 41 |
| Unit/contract/preservation/release-boundary tests | 28 passed |
| Chromium browser checks on standalone runtime | 27 passed |
| Automated accessibility scans | 18 routes; no violations returned for configured WCAG tags |
| Reference category/product routes | 7 categories and 29 product references resolve |
| Responsive widths | 320, 390, 768, 1440; tested pages showed no horizontal overflow |
| Production compilation and TypeScript | Passed |
| npm audit after lock refresh/PostCSS override | Zero reported vulnerabilities |
| Terraform layout validation | dev/staging/production passed; not deployed |

See [machine-readable evidence](verification-2026-10-14.json). Browser checks include unknown-route/archive exclusion,
search recovery, menu state/Escape behavior and disabled checkout readiness. Tests do not prove future commerce workflows.

The npm 10 dependency-tree check recognizes the approved PostCSS override. npm 11's tree display previously flagged
the original upstream pin despite installing the override; clean npm ci, audit and actual builds/browser tests passed.
One Starlette TestClient deprecation warning remains in test tooling; no runtime failure was observed.

Viewport screenshots are generated locally under ignored `artifacts/`; no real customer images or private data are used.
