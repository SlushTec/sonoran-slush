# Four-agent delivery ownership

These are work packages ready for assignment, NOT claims that agents have been launched.
No inherited classroom deadline, fake team identity, hourly automation or existing RPG work-order rules apply.

| Agent | Owns | First integrated deliverable |
| --- | --- | --- |
| AGENT-01 | Storefront, responsive design system, product/configuration UX, customer/owner screens | Approved product browse + accessible persistent configuration |
| AGENT-02 | Commerce domain, contracts, money/stock/payment/proof/quote/event workflows | One durable configuration-to-order path with verified test payment and proof gate |
| AGENT-03 | Optional Bedrock assistant, catalog retrieval, artwork assistance, AI evals | Bounded tool calls over approved data; failure cannot block shopping |
| AGENT-04 | AWS, CI/CD, integration, security/operational evidence | Repeatable non-production deployment with private data boundaries and recoverable release |

## Coordination

Contract owner AGENT-02 publishes changes before dependent UI/AI work. AGENT-04 serially integrates tested PRs.
Each lane works on its own feature branch. Review rotation: 01 reviews 02's customer contracts;
02 reviews 03's tool authority; 03 reviews 04's AI exposure/configuration; 04 reviews 01's release/accessibility evidence.
Cross-domain money/privacy changes additionally require the appropriate domain reviewer and owner release approval.
Do not share an uncommitted worktree or have two agents merge at once. Do not touch unrelated local workloads.

## Milestones, not invented dates

M0: reproducible foundation and preserved sources (this reset).
M1: approved catalog + durable retail/personalization + test payment/proof vertical slice.
M2: all product families, quotes, events and owner production workflows integrated.
M3: optional AI and polished discovery/recovery/notifications.
M4: security/accessibility/performance/restore acceptance and live launch approval.

See `backlog.json`; future tasks start planned, not completed. Agent activation is a separate owner action.

## Finite run checkpoint: 2026-11-10

The canonical delivery board is [Sonoran Slush Store, P-RPG-4](https://linear.app/rpg-chat/project/sonoran-slush-store-e8838e0da62f)
under Slushtec (RPG). The stable project/team binding is recorded in [backlog.json](backlog.json).
That file preserves all 24 original requirements, acceptance text, owner lanes and scaffold statuses;
Linear owns current status, dependencies, decisions and acceptance evidence. This checkpoint is not another board.

### Admitted source and bounded scope

Source: `SlushTec/sonoran-slush` public main `4c8e40f175a7a273e682db09cc278cde03b3276a`,
tree `afbd7103e29d4b8545a0da1d19e8e9d5f4e926d2`. No held source or uncertain derivative is admitted.
The owner-authorized run ends at **20:00 America/Phoenix on 2026-11-10**
(**2026-11-11T03:00:00Z**), with no automatic extension. Stop new implementation by 02:20Z;
reserve remaining time for review, exact-head verification, cleanup and the final receipt.
This finite grant does not change the historical `agents_activated: false` scaffold value into standing authorization.

- Lane A: [RPG-124 / COM-02](https://linear.app/rpg-chat/issue/RPG-124/com-02-qualify-durable-cart-and-stock),
  SS-047 synthetic reservation expiry and late-payment recovery. Deterministic injected time and explicit
  test-only deadlines; exact atomic release once; cancellation/buyer/payment/restart races; paid or
  unknown-payment holds never silently release. No production hold duration or recovery policy is selected.
- Lane B: [RPG-132 / AI-04](https://linear.app/rpg-chat/issue/RPG-132), disconnected restricted SVG paths,
  with bounded static validation and adversarial coverage only. No live artwork processing or production approval.

At most two active store lanes, each with its own clean branch/worktree. Lane B independently reviews this
scaffold-only checkpoint before feature admission. Producers freeze exact commits and trees by shared minute 120;
then each reviews the other's frozen candidate. Lane A owns any later serial composition/integration, only after
both candidates qualify and the coordinator confirms the publication/integration step. Never share uncommitted
work or compose concurrently. Any code change after review requires re-review within the remaining grant or deferral.

### Gates and open acceptance

Scaffold repair and candidate preparation are not acceptance. Full COM-02, SS-047 and AI-04 remain open;
Linear retains criterion-level gaps and owner decisions. Candidate test/review receipts must state the exact source,
changed paths, checks actually run, failures, remaining gaps and rollback. No future check is recorded as passed.
The existing SQLite/WAL, money/replay/stock invariants, proof/payment/capacity independence, legacy quote-release
hold, synthetic-only gates and public non-purchasable catalog must remain intact.

No production deploy or activation, live provider/payment/photo/model/supplier/manufacturing action, customer data,
new credentials/accounts, paid services or AWS resources is authorized. Production inventory, duration, prices,
provider configuration and release policy remain owner decisions. Guided-design `3e57cfb45ece04241342bcf0cc41d74325f2cff7`,
frontend rollup `41eb9b5a67a9c65ceff9a001ce6b1db90a0e6669`, packaging `01db3751c0d157e9bdd103d71cffa823ecd8ac4a`
and the held bundle remain excluded, including uncertain derivatives. The historical initialization archive is not
a current work-order packet. Publication and merge require the separate coordinated review/authorization step.


### Verified update: SVG integration, 2026-11-10

The bounded restricted-SVG source slice for RPG-132 / AI-04 was independently reviewed and merged through
[PR #8](https://github.com/SlushTec/sonoran-slush/pull/8). Reviewed source
`73df66222b9f45ab893c1a413b4123ccb2490e28` and public main merge
`88201a504c5a6a59f83312b68825480e74dc01e2` have the same tree,
`7e0a7ef05eed6d50564aee1fcb8fe1cfade61e2e`. This accepts the bounded source slice only; full AI-04/SS-058 acceptance
and physical manufacturing qualification remain open.

[Exact-head PR verification](https://github.com/SlushTec/sonoran-slush/actions/runs/42907328027) and
[post-merge main verification](https://github.com/SlushTec/sonoran-slush/actions/runs/42907778255) both passed all four
existing verification jobs: preservation/Python, storefront, Terraform layout and container smoke checks.
The workflows and infrastructure were unchanged; no deployment or live activation occurred.

Corrected synthetic expiry candidate `284ad1d50d21632631c20e706fda144bcfbaf4b3`, tree
`897c939e108cb0a110f77d6a573fcf3165ca7466`, passed independent source review and 12 additional adversarial probes,
plus 51 focused tests, 363 aggregate tests and 94 subtests. UTC-normalization overflow is rejected before mutation.
It is being reconciled with the verified public main above without replacing either source history.
The exact combined source still requires composition review, publication approval and fresh exact-head CI before merge.
Full COM-02/SS-047 acceptance and production hold/recovery policy remain open. The finite cutoff and all release/source
holds recorded above remain unchanged. Test/review receipts are technical evidence, not production authorization.


### Conditional reserve admitted: 2026-11-10

Both primary slices were independently reviewed and integrated before the 00:30Z reserve gate,
with more than 150 minutes remaining before the fixed 03:00Z cutoff. SVG PR #8 and expiry
[PR #9](https://github.com/SlushTec/sonoran-slush/pull/9) are merged. PR #9's reviewed head
`3dea037e94646a4559a8847587e56e55a3ed52f3` and current public main
`8b24aa1129881a64e33b5b87bfa8a52c948e4cfa` share tree `5f7f4c281ac1ba1ffed7ceafed2554a0d5583bd1`.
[Expiry exact-head CI](https://github.com/SlushTec/sonoran-slush/actions/runs/42909646339) and
[post-merge main CI](https://github.com/SlushTec/sonoran-slush/actions/runs/42912273975) passed all four
existing jobs, as did the SVG checks linked above. These are bounded source closures, not full feature acceptance.

The existing [RPG-138 / OPS-04](https://linear.app/rpg-chat/issue/RPG-138/ops-04-qualify-recovery-and-operational-visibility)
now admits only an SS-070 test-only, disconnected SQLite backup/isolated-restore drill. It creates its own
synthetic database and byte fixtures; checks committed WAL recovery, current order/proof/reference lineage,
stock/deadline/reconciliation state and existing request/payment-event replay; and rejects corrupt, incomplete
or unsafe restore inputs without overwriting existing targets. Hashes prove integrity, not source authority.
No existing customer database or asset folder is admitted, and external actions stay disabled before and after restore.

Job/outbox recovery, real private-asset or historical proof-file recovery, production schema/behavior-version
qualification, cloud persistence, financial/supplier reconnection, production RPO/RTO, cost and retention are
**NOT ASSESSED**. No queue, asset service, migration, endpoint, dependency or workflow is added. The harness format
is not an application schema version; synthetic metadata/bytes are not private-asset recovery. SS-064, SS-068,
SS-069, full SS-070 and OPS-04 remain open, with their original owner decisions and acceptance unchanged.

Two roles cover this reserve: a producer, who is the sole coordinated serial publisher, and an independent reviewer.
The reviewer first checks this checkpoint before feature edits, then reviews the frozen implementation and exact checks.
Publication and readiness/merge require separate exact-target confirmation; earlier PR approvals do not transfer.
At most two store lanes remain active. Stop new implementation by **2026-11-11T02:20:00Z** and complete safe preservation,
verification and reporting by **2026-11-11T03:00:00Z**; no automatic extension. All existing source and activation holds apply.


### Reserve author verification: 2026-11-10

The narrowed synthetic restore implementation adds 57 drill cases. The author-run related regression passed
212 tests; the full Python run passed **514 tests and 94 subtests**, with no skips and only the existing
Starlette/httpx deprecation warning. Archive verification passed (67 archived and 41 retained business files),
31 active-document internal links passed, and generated OpenAPI contracts matched. The source changes are confined
to the drill test and the existing retail/checkpoint documentation; production code, workflows and dependencies are unchanged.
The implementation remains unpublished pending independent exact-source review and coordinated publication approval.
Fresh exact-head CI and separate readiness/merge confirmation are still required. These checks do not change the
NOT ASSESSED areas or full acceptance boundaries above.

## Finite run checkpoint: 2026-11-11

Brian authorized selecting and executing existing board cards through **20:00 America/Phoenix on 2026-11-11**
(**2026-11-12T03:00:00Z**). This supersedes only the expired run window, not source or production holds.
Baseline is public main `c30b109dd5bdc414713612ec58899f3df9030571`, tree
`068be158f192929e267246bd144c2903391df2dc`. PRs #8-10 are merged; no production activation is implied.
The canonical board remains Linear project P-RPG-4 under Slushtec. No new broad requirement is created.

Selected existing card: [RPG-124 / COM-02](https://linear.app/rpg-chat/issue/RPG-124/com-02-qualify-durable-cart-and-stock),
a bounded **SS-044 synthetic component/lot/location ledger**. It models fixture component definitions
(blank/base/box/consumable, immutable unit), immutable supplier/lot metadata, explicit workshop/market fixture locations,
and balances by lot/location/condition. Conditions distinguish available, damaged, sample, in-production,
completed and shipped. A staff-only movement API records server-derived synthetic staff authority, reason and time;
strict integer quantities, optimistic concurrency and exact request replay prevent silent duplicate movements.
Receipts, multi-leg transfers and condition changes are transactional, cannot create negative balances, and conserve
quantity except explicit fixture receipt or documented count correction. Read endpoints are staff-only and bounded.

This is disconnected from `retail_stock`, retail offers, cart reservations and production release. It must say
`test_mode: true`, `checkout_authoritative: false`, and cannot imply stock can be sold. Do not seed actual business
stock, prices or suppliers, choose reorder/production policies, change existing checkout behavior, or claim full
SS-044/SS-047/COM-02 acceptance. BOM integration, reservations against lots, inspection eligibility, real identities,
production inventory, purchasing/count qualification and cloud persistence remain open.

Two store workers only: producer and independent reviewer, separate worktrees. The reviewer admits this checkpoint
before feature edits, then independently reviews the exact frozen source and runs adversarial tests. Any post-review
code changes require re-review. Stop new implementation by **02:20Z** and preserve progress, close owned processes and
report exact source/tests/blockers by **03:00Z**. No automatic extension. Keep all existing source holds, including
excluded guided-design, frontend-rollup, packaging and held-bundle derivatives; do not read or reconstruct them.
No AWS/WSL, external providers, credentials, customer data, paid calls, manufacturing, deployment or live activation.
Publication and merge remain a separate coordinated exact-target step after review; do not bypass a prior denial.
