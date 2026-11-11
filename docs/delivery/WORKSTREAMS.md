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

### Synthetic ledger author freeze: 2026-11-11

The selected disconnected ledger implementation adds 54 focused cases: immutable definitions, strict validation,
exact/global request replay, version conflicts, authority/stage gates, bounded history/balance reads, condition/location
conservation, competing last-unit movements, audit-insert rollback, overflow rollback, separate-interpreter persistence
and no influence on retail stock or offers. Author-run full regression passed **568 tests and 94 subtests**;
OpenAPI consistency, archive preservation (67/41), 31 document links and diff checks passed. Only the existing
Starlette/httpx warning remains. No skipped checks were counted as passes. Independent source/adversarial review,
Windows verification, publication and exact-head hosted CI are still pending. The implementation stays fixture-only;
all whole-feature gaps, source holds and fixed run boundaries above remain unchanged.

### Continued SS-044 slice: synthetic BOM and reservation planning

PR11 merged as main `72c72c188491f8f7f012685283b4d8e83fb5e5e9`, identical reviewed tree `d22121c6309ff8fcfc678a3c116385cf929e702f`.
All four exact-head jobs passed at run43067147498; Windows/Linux568+94 and19 independent adversarial probes passed.
Post-merge checks must pass before the next feature edits. Native main is clean. No live activation occurred.

Continue existing RPG-124 SS-044/SS-047 with immutable fixture BOM versions and explicit lot/location allocations.
A read-only plan verifies every integer component requirement exactly, rejects duplicate/wrong/missing/overflow allocations,
and reports current lot versions and free units. No automatic lot substitution or production-policy selection.
Fixture reservations are staff-only and disconnected from checkout. States active/released/consumed, with no default expiry.
All-component reserve/release/consume, lot-version changes and audit receipts happen in one transaction. Active allocations
protect the available-stock floor on EVERY ledger transfer/negative correction. Consumption changes fixture condition to
in_production only after removing its own active hold in that same transaction; it never authorizes manufacturing.
Exact command replay is global across movement and reservation operations. Staff time/actor remains server-derived synthetic
shared credential truth. Immutable BOM snapshots cannot be rewritten by a new BOM version or caller-supplied price/actor.

Independent review covers current outflow integration, multi-component contention, release/consume races, final-leg/audit
failure rollback, restart, stale versions and unchanged retail/payment/proof/production gates. Two store workers remain the
producer/reviewer only; exact frozen source and all corrections require independent review. No actual stock, commercial values,
credentials, providers, customer data, AWS/WSL, held source, deployment or activation. Full SS-044/SS-047/COM-02 remains open.
The same implementation stop02:20Z and hard cutoff03:00Z on November12 apply. Publication/conditional merge is a separate
coordinated exact-target step; prior approvals do not cover changed payload automatically.

### BOM/reservation author freeze: 2026-11-11

The fixture BOM and all-component hold slice adds44 focused cases. Final Windows author regression passed612 tests
and94 subtests with no skips; OpenAPI consistency, archive67/41,31 document links and diff checks passed. The existing
Starlette/httpx warning is unchanged. Tests cover immutable BOMs, exact allocations, strict bodies, command replay,
active floors on old outflows, competing reservations, release/consume race, other-hold preservation, independent
interpreter restart, missing-allocation holds, and final-component/per-lot-audit rollback. No source outside the admitted
scope changed. Independent frozen-source/adversarial review and hosted verification remain pending. No actual inventory,
providers, production policy, deployment or live activation. Full feature acceptance remains open.

### Existing RPG-123 SS-006: bounded commercial snapshot registry

Baseline main `0b62029175c5a2a05aba72671694d7ae1014a844`, tree `2c755a79701d799ed56b77c2f46996cea4a6a0bd`.
PR12 exact-head and post-merge runs43072560708/43072971293 passed all four jobs; native main is clean.
Continue existing RPG-123 SS-006 with an explicitly disconnected, staff-only commercial-fixture registry.
The narrow first slice models immutable catalog eligibility, integer-USD price and public-policy TEXT TEST FIXTURE snapshots,
not actual commercial decisions. Draft, approved_test and retired_test states are distinct; shared synthetic staff test
review never becomes owner/production approval. Snapshot bodies reject authority fields and unsupported data. No current
price proposals, private costs, real inventory, customer files or held source are imported into the registry or Git.

Exact snapshot references compose immutable test release sets, with versioned current-test pointer and explicit rollback.
All referenced kinds/products must match and remain approved_test; retiring a referenced snapshot fails resolution closed.
Publishing a new test set changes future fixture resolution only, never rewrites historical snapshots/orders. UUID replay,
optimistic concurrency, immutable audit/provenance and transaction rollback guard state changes. Existing retail offers,
checkout, payment/proof/production gates, public catalog and assistant activation remain unchanged and non-purchasable.
All responses retain test_mode true, owner_approved false and production_approved false. No real approval or live release.

Options, tax and machine-profile semantics are deliberately NOT QUALIFIED in this registry slice; consistent production
version-set acceptance requires them, real reviewer identity and approved data. Full SS-006/COM-01 remains open.
Two store workers: producer and independent reviewer. Reviewer admits checkpoint before feature edits, then frozen source
and adversarial checks; any correction requires re-review. Same02:20Z implementation stop and03:00Z hard cutoff Nov12.
No AWS/WSL, provider/API/model calls, credentials, deployment, live inventory, manufacturing or held-source access.
Publication/conditional merge is a separate coordinated exact-target step after review; earlier approvals do not transfer.

### Commercial fixture snapshot author freeze: 2026-11-11

The narrow registry implementation adds42 focused cases. Final Windows author regression passed654 tests and94 subtests,
with no skips and only the existing Starlette/httpx warning. OpenAPI consistency, archive67/41,31 document links and diff
checks passed. Tests cover strict integer USD, immutable revision/kind, fake authority rejection, simulated lifecycle,
exact compatible sets, current-pointer CAS/replay, valid prior-set rollback, retirement failclosed, concurrent publication,
transaction/audit rollback, restart and corrupt JSON/identity reconciliation. No real pricing/policy data or consumer was
connected. Exact frozen source still requires independent source/adversarial review, publication approval and hosted CI.
All production and source holds and the fixed cutoff remain unchanged; full SS-006/COM-01 is not accepted.

### Independent review correction: persisted fixture containers

Independent review of the first freeze reproduced two malformed persisted-state exceptions: null snapshot audit and
list-valued set references. The correction adds typed boundary validation for stored rows, kind/identity, audit/lifecycle,
manifest references/hashes/unqualified domains, pointer identity and publication provenance. Invalid stored structures now
return controlled409 before mutation rather than blanket-catching business logic.24 additional regressions cover the
reported failures and adjacent malformed rows, authority metadata, pointer values and history mismatch. Corrected author
full regression passed678 tests and94 subtests; OpenAPI/archive67/41/doc31/diff checks pass. Corrected exact source requires
independent re-review; the old654-test review does not transfer automatically. No publication or live action occurred.

### Existing RPG-123 SS-006.AC3: read-only fixture comparison checkpoint

Baseline babf911bb2ecf3d3c779445d0dbbab74a0871215, tree a327baa326129f22216df01856eb97974e313846.
Isolated branch work/rpg123-commercial-diff-20261111; independent reviewer admits this checkpoint before feature edits.
Implement staff-only, retail-test-gated comparison of exact immutable snapshot revisions of the same kind and exact
release-set identities. Deterministic added/removed/changed rows cover catalog eligibility, per-product/variant integer
USD fixture prices with explicit deltas, and policy fixture text. Include exact identities, lifecycle state and explicitly
unqualified options/tax/machine domains. No production prices, actual approval, historical-order rewriting or checkout.
All success responses retain test_mode true, owner_approved false and production_approved false.

Use existing typed persisted validators, strict exact reference inputs and controlled missing/corrupt-state failures.
Release-set comparison validates referenced hashes, compatible products and approved_test lifecycle; retired references
fail closed. Standalone snapshot comparison may show draft/approved_test/retired_test state but confers no readiness.
Use one consistent SQLite read transaction through a read-only connection. Do not invoke schema creation or the existing
write transaction helper. Missing database or tables return bounded404/409 without creating database files or tables.
Comparison cannot change pointer, history, audits, commands, snapshots, sets or other domain state; no replay command.

Tests cover gates, strict request shapes, kind mismatch, exact revisions, deterministic row ordering, unchanged pairs,
added/removed variants, eligibility changes, strict money deltas, policy text, lifecycle/retired refs, malformed persisted
state and byte/schema/domain-write absence including fresh databases. Verify consistent reads under concurrent writes.
Run full regression, OpenAPI/archive/link/diff checks, freeze exact source and independent adversarial review before any
publication. This is only AC3 fixture review-diff groundwork; completed orders and real commercial acceptance stay open.
Two store workers only; no held source, costs, customer data, credentials, providers, GPU, AWS/WSL or live activation.
Implementation stops November12 02:20Z; hard cutoff03:00Z. Publication is a separate exact-target coordinated decision.

### Fixture comparison author freeze: 2026-11-11

The read-only comparison slice adds57 regression cases; Windows full suite passed735 tests and94 subtests with no skips.
OpenAPI consistency, archive67/41,31 document links and diff checks passed; existing Starlette/httpx warning remains.
Early independent probes found nonASCII persisted fingerprint and invalidUTF8 BLOB document errors. Narrow guards now
validate lowercase hexadecimal fingerprints before constant-time comparison and reject non-text persisted JSON containers.
No blanket endpoint exception handling was added. Final source still requires independent exact-freeze review.
Tests cover both comparisons, strict inputs, lifecycles, hashes, invalid state, bounded failures, no domain/schema changes,
absent DB/parent noncreation and a consistent read while another connection retires a reference. SQLite may create transient
WAL/shared-memory reader coordination sidecars beside an existing database; zero filesystem activity is NOT claimed.
No publication, actual approval, price decision, customer/order change, deployment or production activation occurred.

### Existing RPG-124 SS-031.AC4: bounded piece-personalization design checkpoint

Design only, based on reviewed comparison9ba01770dbbfa03c42ac90715e99d451ce34d075. Before implementation,
rebase this checkpoint onto the integrated identical-tree main and obtain independent design admission.
One producer plus one reviewer only; no new task or second inventory/configuration registry.

Add an optional RetailItem-only personalization discriminated union to existing synthetic cart/order flow:
identical: {mode: identical, text: nonblank string}; per_piece: {mode: per_piece, pieces: [{set_index: integer,
piece_index: integer, text: nonblank string}]}. Indices are zero-based. Strict text is1..120 characters, no NUL or
control characters; do not silently trim/case-fold customer wording. Repeated text is valid; repeated indices are not.
No caller set_size, stock_units, item index, offer version or money fields in this object. Explicit null is rejected;
omission retains legacy behavior. Both modes reject nonempty legacy text/secondary. In explicit mode allow only the
existing known crystal-shape/Size/Orientation option keys, rejecting arbitrary options that could compete for names
or set-size authority. Font remains common; notes/artwork metadata never supplies piece text or changes the mapping.

Add optional staff-only test Offer.pieces_per_item (StrictInt1..100), distinct from stock-consumption units_per_item.
Never infer it from stock units, shape or customer input. Offers lacking an explicit pieces_per_item reject structured
personalization with409 while retaining exact legacy behavior. Bound explicit personalization to500 positions per line and2000
across a cart, without reducing limits for legacy omitted-field carts. Require every pair in quantity x pieces_per_item
exactly once for per_piece. Identical expands explicitly to the same bounded mapping. Never auto-fill missing names.

Normalized output is a line-only personalization_snapshot: {schema_version:1, mode, line_index, quantity,
pieces_per_item, pieces:[{set_index,piece_index,text}...]}, sorted by indices with stable original cart line order.
Persist this exact mapping in existing cart lines and copied order lines; retain exact submitted item configuration.
Persist explicit pieces_per_item in the existing staff test offer and bump its existing CAS version when changed.
Stock_units remains quantity x units_per_item only. Omitted new offer field preserves the exact legacy offer document;
reject explicit null for the new count. No separate endpoint/table, pricing effect, inventory authority, catalog
sellability or manufacturing authorization. Physical product set qualification remains outside this fixture contract.

Compatibility: omit the new key from serialized legacy request items when absent, preserving existing normalized
payload/fingerprint bytes including old defaults/photo_brief null. Never globally exclude_none or exclude_unset.
Old carts missing the field retain identical priced-line shape, exact replay and cart-to-order behavior. Explicit-mode
raw payload remains fingerprinted; reordered or changed input on the same UUID conflicts rather than mutating history.
Repricing recomputes the same mapping; changed offer versions/counts fail409 before reservation. Validate persisted
explicit item shape and snapshot equivalence before order creation; corrupt mapping cannot be copied or silently fixed.

Proof revisions continue their independent text/version workflow and cannot rewrite ordered piece assignments. This
slice does not interpret proof prose or establish per-piece manufacturing proof approval; those remain open criteria.
Tests cover singleton/set/multi-line, missing/extra/duplicate/negative/bool indices, reordered deterministic mapping,
Unicode text, collisions, cardinality bounds, altered offer, exact replay/restart, legacy fingerprints and old carts,
rollback/no reservation on validation failure, copied order immutability and proof revision independence. Full tests,
OpenAPI/archive/link/diff checks and exact frozen independent review required. No real names/prices/policies, providers,
held sources, AWS/WSL or deployment. Stop implementation02:20Z, hard cutoff03:00Z November12; publication separate.

### Piece personalization author freeze: 2026-11-11

The existing synthetic cart/order flow now accepts explicit identical/per-piece assignments with separately configured
staff pieces_per_item, never inferred from inventory units.45 focused cases and full780 tests+94 subtests pass on Windows;
OpenAPI/archive67/41/doc31/diff checks pass. Actual prechange model serialization was run from frozen9ba0177 and matched
against current normalized output at fixed UUID digest1616f47111c82279e29a754b4c7b049790d31007300a9efc19ff6a6d11521834.
Initial full regression exposed restore-drill consumers observing a new null field; the corrected model serializer omits
only the newly absent field everywhere, preserving legacy defaults/digests without weakening existing drill assertions.

Omitting pieces_per_item on an update preserves an existing explicit value; entirely legacy offers retain their shape.
Strict cardinality, index/text controls, conflicting inscription fields, malformed persisted mappings, replay/restart,
changed offers, no partial reservations, exact cart/order copying and proof-revision independence are covered. Valid
Unicode and surrounding whitespace remain exact; controls and surrogates are rejected only in the new text contract.
No actual names/prices, manufacturing proof qualification, held-source access, deployment or live activation occurred.
Frozen source awaits independent review and coordinated publication. Full SS-031/COM-02 remains open.

### Independent contract correction: optional does not mean nullable

Independent review found OpenAPI advertised null for new optional personalization/piece-count fields even though the
runtime deliberately rejects explicit null. SkipJsonSchema omits that unsupported branch and removes default-null
metadata while keeping fields optional. Two regressions inspect endpoint-linked schemas and actual422 behavior. The
first test lookup used ambiguous Offer schema naming and was corrected to follow the actual endpoint reference.
Final full regression passes782 tests+94 subtests; OpenAPI/archive67/41/doc31/diff checks pass. Runtime/legacy shape
behavior is unchanged. Prior e30d4a8 bundle is superseded; corrected source requires independent exact-freeze review.

### Existing RPG-126 SS-032: proof history and material binding checkpoint

Baseline integrated98abebb154f51a50e9f0c7a0e9e61f96f24f8943/treeffcf4fcaffa96c4c7dc1ada3bc0a9ddd9f7acd49.
Design only before independent admission. Extend existing local proof/order flow, not a generic registry or new commerce
system. Preserve proof IDs, current response fields, private capability authorization and exact-version checks.

Add proof-specific append-only revision and decision evidence alongside current proof state in the same SQLite transaction.
Revision evidence retains actual wording, exact version, server preparation timestamp, material context snapshot/hash and
explicit limitations. Decision evidence retains exact version/hash, action/comment and server timestamp. Actor truth is
shared synthetic staff credential for preparation and holder of this private proof capability for decisions; no individual
customer identity or real signature is inferred. No overwrite/delete route for evidence. Current state remains compatible.

Material context is exact order id, items, lines (including per-piece mappings), total_minor and currency. Missing lines on
legacy quote orders are explicitly null, never invented. Exclude payment, status, capacity, holds, timeline and update times.
Canonical JSON uses sorted keys, compact separators, ensure_ascii=False and UTF8, then SHA256. Validate admitted structures,
strict money/types and new piece mapping before binding; malformed persisted state gives bounded409. Legacy unpaired
surrogate text causes controlled409 reconciliation, not UTF8 crash, silent replacement or changed historical text.

Capacity is32MiB per material context, not1MiB. Analytical envelope includes100 items duplicated in lines, bounded legacy
text/options/photo fields with worst6-byte JSON control escapes, plus2000 structured pieces at120 supplementaryUnicode
characters repeated in raw item/line item/normalized mapping and bounded JSON/index overhead; conservative envelope<24MiB.
Validated synthetic probes: maxlegacy Unicode11,792,206B; mixed2000-piece Unicode14,789,806B; worst-control legacy17,596,106B;
mixed worst-control legacy plus Unicode names20,523,090B. Escaping all Unicode would reach43,411,054B, so do not use that
encoding. Automated valid-max fixtures and calculated-envelope regression must preserve every currently admitted order;
any discovered higher legal bound must be reconciled before admission to a smaller downstream cap, not silently rejected.

Legacy proof GET remains readable without mutation. A retained proof lacking bound evidence cannot obtain a new approval
or fresh release: require staff to prepare a new revision presented for review. First actual revision preserves only the
retained legacy current document as explicitly unbound observed evidence with captured_at now. Missing earlier revisions,
actors, approval timestamps and past configurations are unknown, never reconstructed as facts. New preparation advances
existing version/CAS, clears active approval and stores fresh bound revision. No migration/approval occurs on GET.

Approval verifies current revision evidence and live material hash before an idempotent repeat; stale links/changed material
fail closed. Release verifies the actual approved proof and context, not merely order flags, while preserving payment,
reservation, capacity, exact proof-version and stage gates. Already executed in_production retries stay non-mutating receipts,
not a new authorization or retroactive revocation. Legacy quote release remains blocked by its existing migration rule.

Repeated prepare with stale expected version returns409 without duplicate history; it is not represented as successful replay.
Identical current decision repeats add no evidence; conflicting repeated comment/decision requires explicit transition or409.
Approved to changes_requested preserves prior approval as historical fact and clears active approval. New wording requires
new revision. Any final proof/order/evidence write failure rolls back the entire transaction; contention cannot split state.
Technical new-prepare version bound1000 is not a customer revisions policy; do not apply it retroactively to readable history.

Bound history GET by strict cursor and limit<=25, metadata/digest summaries only (never25 full32MiB contexts), with same proof
capability or staff authorization. Exact authorized revision GET may return one bounded snapshot; no cross-order leakage.
Tests cover actual legacy readability/new reapproval, immutable old spelling/decisions, material changes versus nonmaterial
churn, old proof links, exact repeats and concurrency, malformed/Unicode containers, rollback/restart, maxvalid size, bounded
reads, altered piece mapping and current restore-drill compatibility. Full Python/OpenAPI/archive/link/diff checks and frozen
independent source/adversarial review required. No fabricated image/export hashes, actual customer data, providers, machine
profiles, real production qualification, held source, AWS/WSL or deployment. Full SS-032/COM-04 remains open. Two workers only;
implementation stop02:20Z and hard cutoff03:00Z November12, no extension or publication implied by checkpoint admission.

Storage refinement: persist each exact canonical material context once per SHA256 in a proof-specific immutable context
store; hash includes order id. Revisions refer to that context hash rather than copying up to32MiB on each unchanged
revision. On existing-hash insertion require identical canonical bytes and typed order identity, otherwise fail409; no
silent collision overwrite. Reads verify stored bytes against hash and typed context; approval/release also compare the
live order hash. Exact authorized revision resolution may fetch one bounded context; summary pagination never does.
Context/revision/decision/current-proof/order writes share one transaction, including failure-injection coverage for each
final write. No separate commercial authority or consumer registry; immutable contexts belong only to proof evidence.
