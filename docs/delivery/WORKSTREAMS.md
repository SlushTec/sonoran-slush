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
