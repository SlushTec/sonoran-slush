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

### Proof evidence author freeze: 2026-11-11

Author full Windows regression passes 828 tests + 94 subtests, with 46 new cases and no skips. OpenAPI/archive67/41/doc31/diff
checks pass. Restore drill now explicitly verifies all four added evidence tables and independent seeded counts/context
hashes/order fields/revision wording/decision links; it does not ignore new tables. Tested current max configured material
exceeds19MiB and fits the conservative<24MiB envelope under the32MiB cap. Empty legacy bulk orders remain readable but
cannot acquire invented configuration; fresh bound preparation requires configured-order migration.

Early independent probes found malformed history metadata timestamp transport errors/coercion and a corrupted private
proof payload redirect. Narrow ISO-string/type checks and requested-record identity guards now reject those cases. SQL
context type/byte-length metadata is checked before fetching/parsing the material blob. Strict integer schema/current/
approved versions reject booleans. Exact revision/decision timestamps use the same ISO checks. Four originally reported
probes were rerun successfully; final frozen independent full/adversarial review remains required before publication.
No actual identity/legacy history/export hashes, prices, machine qualification, providers, deployment or live action.

Final correction rejects present malformed binding markers (boolean, null, string or unsupported integer) on both history reads and fresh preparation; legacy means absent marker only. Four additional regressions passed in the final 828-test run. Independent frozen-source review remains required.


## November 11: RPG-121 public proof portal checkpoint (admission pending)

Producer: review_stock_ledger; independent reviewer/integration: plan_execute_store_cards.
Base: merged PR16 53b5feba866f0845af474cb96f510728bcaefe93, tree 24ab9cbc6755bfd54c8b6fa1c195111311ab85c2.
Existing scope: customer-facing consumer of bound proof history under RPG-121, partial SS-032.
This is not another registry, actual customer import, deployment, production approval or completion of the broad card.
Only tracked public-main CustomerPortal/client contracts and relevant public styles/tests may be inspected.
Held guided-design/frontend-rollup/bundle sources and derivatives remain prohibited; no reconstruction from them.

Planned paths: apps/storefront/src/components/CustomerPortal.tsx (thin Portal dispatcher and renamed legacy function),
new ProofReviewPortal.tsx, new tests/frontend/proof-review.test.cjs, new tests/e2e/proof-review.spec.ts,
and proof documentation/checkpoint. Public CSS may be reused, not redesigned. No shared client or backend changes.
Portal dispatcher has no hooks: proofs render new ProofReviewPortal; orders/quotes render LegacyRecordPortal.
The original legacy body, payment behavior, Stripe URL guard and quote behavior remain unchanged.
No conditional early return before existing hooks and no changes to held/customization surfaces.

Private session: credentials only in component/ref memory, never URL, storage, analytics or logs.
Loaded credentials are an immutable pair tied to record identity and a monotonically invalidated generation.
Synchronous action locks prevent duplicate submissions before React state updates.
Every lookup/history/detail/action result, error and finally block checks its generation/request identity.
Close, credential edits, unmount, browser Back/popstate and pagehide invalidate all pending responses and clear private state.
BFCache restoration clears again; reopening requires fresh credentials. Close remains available during requests.
Network timeout remains the existing client's 12 seconds; no false claim that ignored requests were canceled server-side.

Current proof and historical version views are explicitly separate. Historical views contain no action controls.
Current approval requires current exact integer version, binding_schema 1 and matching fetched revision identity/order/text/hash.
Returning to current refetches current proof and its bound evidence, clears confirmation/comment and never reuses stale authority.
A stale/malformed/missing context or 409 blocks approval with a refresh/reconciliation action, not optimistic success.
Unbound legacy wording stays readable with a clear request for a newly prepared bound revision; unknown history is not invented.
Approval records this exact proof only; payment, inventory and production readiness are separate gates.
No historical image guarantee: evidence binds wording/configuration, not immutable historical image bytes.

History uses bounded metadata pages of 25 and explicit cursor navigation, not automatic crawling or fetching 25 contexts.
Only one selected detail/context is loaded at a time; a context can reach 32 MiB, so no raw JSON or unbounded DOM rendering.
Render concise configuration summaries and at most 25 per-piece entries per local page; never mount 2000 names at once.
Validate response shape/identity and bounded monotonic cursor values; errors/retries must preserve session isolation.
Treat response text as text, not HTML. Show recorded capability-holder labels, not invented real identities.
Accessible labels, keyboard controls, status/error announcements and focus restoration accompany mobile overflow checks.

Planned verification: existing full Python and Node regressions, separate new Node component tests, typecheck/build,
headless Playwright synthetic API fixtures, axe and actual screenshot inspection at desktop/mobile sizes.
Deferred-response tests cover Close, edits, Back, unmount/reopen, cross-session lookup/action and stale finally blocks.
Other tests cover duplicate clicks, error/retry, pagination, current-versus-historical actions, exact action versions,
legacy unbound/malformed binding, 409 refresh and no credential persistence. Existing payment guard remains unchanged.
Native Windows headless/local test servers only: do not touch the user's open browsers or spawn visible background windows.
Stop owned test servers/processes after QA. Report unrelated existing failures without expanding scope.
No feature edits before independent checkpoint admission; no publication before frozen-source independent review.
Same authorized cutoff: November 12 03:00 UTC, with implementation stop at 02:20 UTC; no further agents, AWS or WSL.


### Proof portal checkpoint correction: routine verification wiring

Additional narrowly scoped paths: root package.json, .github/workflows/verify.yml and the existing
tests/frontend/storefront.test.cjs proof-success fixtures/assertions only. Nonproof tests remain unchanged.
The root test:frontend command currently names only storefront.test.cjs; include both explicit test filenames
so routine CI executes the new proof lifecycle cases rather than leaving them as an optional manual command.
Existing proof-success fixtures must supply the real bound revision/evidence shape; retain and extend assertions,
not weaken approval expectations or remove previous coverage.

The storefront verification job builds without a commerce origin today. Add only its CI job environment
NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid so the compiled local QA build reaches Playwright's
synthetic routes. New browser tests intercept only this reserved invalid host, assert requests and use no real service.
Apply the same explicit environment to local QA build/start. No production default, fallback, special client branch,
test backdoor, new credential, provider activation or modification of the shared commerce client is permitted.
Do not skip browser flows when the origin is absent: fail the QA setup clearly. No change to deployment configuration
or the separate containers job; its closed readiness behavior remains unchanged.
Any owned background server helper must use hidden-window startup and be stopped after required headless QA.


### Integrated local proof smoke acceptance

Before publication, run at least one headless browser flow against the actual current Python ASGI commerce app,
not only mocked browser responses. Start an owned Uvicorn process on an unused loopback port with an isolated
temporary fixture database and disposable synthetic fixture credentials. Seed a synthetic offer/cart/order/proof
through supported fixture/staff APIs, then open the new portal, retrieve bound evidence, record an exact-version
decision and verify the actual persisted history through the app. Include a later revision and read-only prior view.
The test harness may relay requests for the compiled https://commerce.qa.invalid origin to this owned loopback app,
preserving request method, body and authorization and returning actual backend responses. This relay exists solely
in the headless test runner, never in application/runtime code. No production fallback or runtime test backdoor.
Keep this integrated smoke separately labeled from mocked lifecycle tests. If frontend CI lacks Python dependencies,
run and document it locally with exact source and outcomes rather than claiming mocked tests are full-stack evidence.
Use only synthetic data, no live provider/payment or customer details. Start background helpers hidden, verify HTTP
readiness and stop all owned Uvicorn/frontend/browser processes afterward without touching unrelated ports/processes.


### Public proof portal implementation and author verification

Implemented a separate proof-only consumer with hook-free Portal routing. Compared the complete legacy orders/quotes
function body against base 53b5feb after its name change: byte-equivalent, including payment URL guard. Backend and
shared client are unchanged. Routine Node CI now runs both explicit suites; only the storefront QA job gets the invalid
test origin. No held source, real customer data, new business values, deployment or production activation was used.

Reviewer findings fixed before freeze: actual secondary inscription/font fields, historical metadata hash matching,
BFCache-only pageshow clearing, bounded Unicode code-point rendering and malformed lone-surrogate rejection.
Decision evidence now requires exact schema/proof/order/version/hash identity; current status and approved version
must agree with the last recorded decision. Partial or mismatched responses cannot display a false approval confirmation.
Actual pixel QA found missing public logos in standalone preview; the separately admitted repair copies only Git-tracked
public assets into validated owned standalone destinations. HTTP hash/image-load regression verifies it. Heading focus
uses a sticky-header scroll margin. Screenshots were regenerated and inspected after the correction, not reused as proof.

Author checks: 828 Python tests + 94 subtests; 68 Node tests (47 new); 38 headless Playwright tests (6 new), including
desktop/mobile axe and real loaded asset hashes. TypeScript, optimized build, OpenAPI, archive 67/41 and document links pass.
No test skips. Native npm nested-script stdin failure was avoided by executing the exact underlying locked commands;
CI retains standard npm commands. Early unscoped browser locators collided with existing global announcements and were
corrected to exact proof messages. Existing Next background-prefetch NoFallbackError noise was observed separately from
passing route tests; it was not suppressed or claimed fixed.

Separately labeled real-backend smoke passed against current ASGI code and isolated synthetic SQLite state: 10 actual
relayed browser requests, one persisted approval, prior revision immutable after new revision, historical read-only and
Close clearing credentials. Last owned backend/preview PIDs 29332/20044, ports 52277/52278 stopped/closed and temporary
database removed. Headless Playwright-owned preview port 3137 is also closed. No user browser was touched.

Current screenshots: artifacts/proof-desktop.png, artifacts/proof-mobile.png, artifacts/proof-real-backend.png.
They show readable current/history/configuration/decision layouts with loaded brand assets and no plaintext credentials.
Useful external logs/config are retained under the existing D: delivery folder. Frozen independent review is still
required; broad RPG-121/SS-032 and production qualification are not complete merely because this slice passes.

### RPG-125 bounded Square sandbox order-portal alignment checkpoint

Producer: second store worker; independent reviewer/integrator: store coordinator. Base is frozen PR17
4dcdf820; no implementation until PR17 integration and independent design admission. Rebase docs onto
actual merged equivalent source first. Same fixed 03:00 UTC cutoff, implementation stop 02:20 UTC.
Only tracked public source; no held guided-design/frontend-rollup/bundle sources or derivatives.

Observed mismatch: CustomerPortal.pay currently accepts Stripe while payments.py sandbox_checkout_url
accepts only https://sandbox.square.link[:443]/u/[A-Za-z0-9_-]+ with whole raw-string matching.
Replace the obsolete guard, not broaden it. Require raw string exact full match (JS dollar-anchor final
newline must not pass), provider === square, test_mode === true and nonempty bounded string session_id.
Do not normalize, trim, decode or repair URLs. Reject live Square, Stripe, userinfo, lookalike hosts,
non-default/zero-padded ports, query/fragment, encoded paths, whitespace, controls and extra path segments.
Backend remains payment authority; no new payment availability, paid status or production authorization.

Use a separate order-only component via hook-free Portal routing so proof portal and quote body stay
unchanged. Scope: CustomerPortal wrapper, new OrderReviewPortal component and focused tests/docs only;
minimal explicit routine Node test wiring is allowed. No backend, shared client, provider or proof changes.
Preserve order read display, existing local simulation and availability gates; backend tests remain final
truth. Label processor action Open Square sandbox checkout, only for strict test_payment_available true.
Do not interpret an accepted redirect as paid. Existing synthetic retail simulation remains separately
labeled and never uses Square. Missing/malformed current id/version must disable mutation fail-closed.

Loaded session binds immutable order id, trimmed capability, positive strict version and generation.
Input edit, Close, Back/pagehide, persisted pageshow and unmount invalidate pending lookup/action results
and navigation; ordinary pageshow does not clear typed input. Record id must match requested id.
Use synchronous per-session action lock to prevent duplicate clicks before React state commits. Every
success/error/finally checks session/request generation; stale old responses cannot alter a new session.
Payment request remains exact {order_id,version} and captured bearer. Mutating responses must match loaded
record identity; refresh after conflicts, not silently adopt an unrelated record. Private data stays in
memory only, absent URL/local/session storage/logs. Close available while busy. No browser/provider opened
by automated tests; test navigation is intercepted before any external request.

QA: table-driven raw URL parity with backend allow/reject cases and final-newline edge; malformed provider,
test_mode/session id, exact bearer/version, unavailable/malformed order gating, duplicate click, 409/retry,
late lookup/action after Close/edit/Back/unmount and reopened session isolation. Retain order simulation
and quote/proof regressions. Full Python/Node/typecheck/build/browser/accessibility/mobile/pixel checks.
One separately labeled actual local ASGI checkout smoke may stub the provider adapter only within its
isolated synthetic test process, exercising real endpoint/auth/order gates and browser response handling.
No actual provider request, account credential, real customer or live payment; do not call this live Square
verification. Owned hidden loopback test servers/headless browser only; verify cleanup and preserve evidence.
Use existing locked dependencies without competing install. No production deploy, AWS or WSL.

### Square order portal author implementation and verification

Implemented the admitted order-only consumer with exact raw Square sandbox URL/provider metadata,
captured capability/order/version, synchronous duplicate lock, stale-response/navigation invalidation,
strict checkout availability and bounded record rendering. The complete LegacyRecordPortal function
and ProofReviewPortal source were compared against 4dcdf820 and remain byte-equivalent after newline
normalization. No local simulation action existed in that order surface; none was invented. Backend,
shared client, production settings and held sources remain untouched.

Author checks: 828 Python tests + 94 subtests, 104 Node tests (36 new), 43 browser tests (5 new),
TypeScript and optimized build pass. Archive 67/41, document links 31 and diff checks pass. No skips.
Whole-page WCAG2A/AA and all axe rules scoped to the new .lookup-layout pass at desktop/mobile sizes.
An initial all-rules whole-page run found existing axe region best-practice violation on .announcement,
Header.tsx:47 (unchanged against baseline). This is recorded, not suppressed as fixed or claimed
all-page-all-rules clean. Existing background-prefetch Next NoFallbackError log noise remains separate.
Pixel QA caught undefined new form-panel/text-link classes and corrected them to existing lookup-card,
order-result and link-button styles before final build/browser/smoke reruns. Final artifacts/order-1440.png,
order-390.png and order-real-backend.png were individually visually inspected: readable, no overflow,
loaded brand assets and no plaintext access codes.

Separately labeled actual loopback ASGI smoke passed: supported quote/offer/accept/order creation,
real checkout endpoint/auth/gates, one intercepted sandbox navigation, persisted session replay and
payment still unpaid. Provider adapter is stubbed only in isolated test process; urllib provider access
is forbidden. This is not a live Square sandbox connection. Final owned PIDs18796/29444 and ports
60150/60152 were stopped/closed, temporary synthetic DB removed; browser QA port3138 also closed.
Only headless owned browsers used. No user browser, actual provider credential, payment or deployment.
PR17 remains a stacked dependency until coordinator integrates its exact green source; no successor
publication or merge is authorized ahead of that dependency. Frozen independent review is still required.


### RPG-121 bounded private quote consumer checkpoint

Producer: second store worker; independent reviewer/integrator: store coordinator. Stack base49b0c142,
independently qualified Square slice; publication remains dependent on preceding green integrations.
This checkpoint is documentation only. No feature edits before independent admission. Implementation
stops02:20UTC, finalcutoff03:00UTC. No helpers, held guided frontend/design/rollup/bundle source, AWS/WSL.

Observed public source: GET /v1/quotes/{id} reads retail/bulk/event/contact; accept permits only
retail/bulk/event with exact current version, offered status and reviewed total. Current UI trusts
mutable entered token and returned identity and lacks request-generation guards. Preserve backend truth.
Create a separate QuoteReviewPortal and hook-free dispatch; keep complete legacy body, proof and Square
components unchanged. No backend/shared client/payment/policy changes, new price or inferred identity.

Read response must match requested ID, supported kind, positive safe-integer version and bounded status.
Submitted requests remain readable with total_minor null; reviewed totals are integer1..99999999/USD.
Message supports full3000 Unicode codepoints and valid multiline CR/LF/tab as accepted by public Offer;
render escaped text with whitespace preserved, not HTML. Reject lone surrogates and malformed rendered
containers safely. Do not blanket restrict unrendered legacy fields. Current quote accepted status must
have accepted_version exactly equal to its version; inconsistent accepted metadata fails closed, not
a success banner. Offered state must not imply accepted current version. Contact remains read-only
even if malformed data labels it offered. Missing reviewed message/total disables acceptance honestly.

Display actual status, total, full offered message and next step, with no invented people/timestamps.
Show bounded recorded item summaries if supplied: actual max100 items, quantity1..500, product100 chars,
text/secondary120 and known font; paginate10. Preserve full valid multiline/Unicode at backend bounds.
If optional timeline is shown, metadata validates ISO timestamps/strings and paginates25; do not invent
or reconstruct unavailable history. No historical quote versions are claimed by this current-only UI.

Bind loaded record ID/kind/version and trimmed capability in immutable session plus request generation.
Close/input edit/Back/pagehide/persisted pageshow/unmount clear confirmation and invalidate all pending
lookup/action/error/finally responses; ordinary pageshow preserves input. Synchronous action lock blocks
duplicate clicks before React commit. Checkbox explicitly acknowledges displayed exact version. POST
uses captured bearer and {version,decision:accept}; returned success requires same ID/kind/version,
status accepted, accepted_version equal requested version, and unchanged displayed commercial details
(total/currency/message/items when shown). Never confirm a different quote/version or silent price change.
Failures clear actionable record/checkbox and require reopening; late failures cannot clobber new session.
Acceptance means holder of this private capability accepted this quote version, not verified personal
identity, payment, booking, inventory or production confirmation. No credentials in storage/URL/logs.

QA: full regression plus malformed identity/version/accepted metadata, contact read-only, null totals,
exact multiline/emoji boundaries, maximum item pagination, changed price/message in success, repeated
accept/replay, duplicate click,409/reopen and delayed lookup/action after each lifecycle invalidation.
Browser tests include keyboard/mobile/current success/failure/interruption, WCAG2A/AA whole page and all
axe rules scoped to new component, actual pixel views. Real loopback ASGI synthetic quote creation,
offer and private acceptance with stored/replayed exact accepted_version, including contact read-only.
No provider calls or actual customer data. Hidden owned localservers/headless browser only; cleanup
verified. Existing locked dependencies reused, separate build. Frozen source and evidence go to peer
review before any publication; this does not mark all RPG-121 or production delivery complete.


### Quote consumer author implementation and evidence

Implemented separate current-quote consumer with supported retail/bulk/event/contact reads, contact
read-only, full multiline/codepoint limits, bounded item pages, immutable capability/version session,
stale response isolation and synchronous duplicate lock. Success requires exact returned accepted
identity/version and unchanged displayed commercial terms. No invented customer identity, booking,
payment or production confirmation. LegacyRecordPortal body and complete proof/Square components
verified byte-equivalent against49b0c142 after newline normalization; only dispatch/import changed.
Backend and shared client unchanged. No held sources, provider calls or live data.

Author regression:828 Python +94 subtests,153 Node (49new),49 browser (6new), TypeScript/optimized build,
archive67/41,document links31,diff checks pass; no skips. Browser checks cover whole-page WCAG2A/AA
and all axe rules scoped to new quote component. Existing global announcement landmark best-practice
issue and background Next prefetch noise remain outside this scope, not claimed fixed.
Final artifacts/quote-1440.png,quote-390.png,quote-real-backend.png individually inspected: full
multiline terms, item inscriptions, explicit acceptance and separate-decision copy readable, no overflow
or plaintext capability. Build and all evidence use the new consumer, not stale old portal assets.

Separately labeled actual ASGI smoke passed on isolated synthetic SQLite: quote creation/offer, browser
exact-version acceptance, persisted accepted_version2, identical replay and contact read-only. Three
browser API requests relayed to real loopback server; no provider calls. Owned PIDs17244/2624 and
ports55197/55198 stopped/closed, temporary database removed; Playwright port3139 also verified closed.
No user browser, deployment, credentials, prices/policies or production state touched.
This branch remains stacked on independently qualified49b0c142 and cannot publish/merge ahead of
required predecessor CI. Exact frozen source still requires independent review before integration.


### RPG-122 / SS-071 staff lock race checkpoint

Producer second store worker; coordinator independent review. Isolated branch based frozenbf2200ec,
stacked behind required predecessor CI. Docs only before admission. Implementation stop02:20UTC,
finalcutoff03:00UTC. Only existing tracked public StaffWorkspace.tsx plus focused tests/docs/routine
test wiring. No held source, new role/account/settings/provider/deploy/AWS/WSL or extra agents.

Verified parent reproduction on public53b5feb: dispatch quote offer, Lock while pending, resolve result;
old action sets private doc and calls overview with captured old token, reopening a locked workspace.
Patch existing component narrowly rather than adding a new staff feature or changing backend authority.

Introduce immutable staff session token/generation and a separate record-context/request generation.
Login creates captured session; overview/open/action responses commit only to their original current
session and matching operation/context. Every async success/error/finally checks validity. Invalidate
on Lock, credential edit, Back/pagehide/persisted pageshow and unmount; ordinary pageshow preserves entry.
Record reference edit/change invalidates pending record/action result, clears old record/receipt/drafts;
no old mutation continuation may start summary refresh after its context/session is invalidated.
Synchronous lock prevents duplicate login/open/action before React commits; Lock stays available while
requests are pending, including login cancellation. A new session must not inherit prior private data.

Central clearing resets token, summary, doc, reference, receipt, error/status, price/message/proof,
inventory/capacity, tracking/carrier and operation flags. Record changes clear record-specific drafts
and receipt before loading; opening a different record cannot retain a prior proof/shipping form.
Capture actual record ID/version in mutations, retain existing endpoints/bodies/backend versions/gates.
Guard returned record identity when operation mutates same record; receipt-producing operations keep
their actual existing receipt semantics rather than requiring a false same-ID assumption.

After verified write response, show honest write outcome even if subsequent summary refresh fails:
report write confirmed but overview stale/retry needed, not falsely imply mutation failed or retry it
automatically. If response malformed/uncertain, do not claim success; require reconciliation. Lock
invalidates UI continuation, NOT an already-sent server mutation; state this clearly in interface/docs.
Receipt is only retained in its matching current session/context and is cleared before a new operation;
never download old private receipt after Lock or context change. No storage/URL/log credential leakage.

Tests reproduce original race then prove no post-Lock summary request and no private resurrection.
Cover login/open/action/overview delayed successes and failures, Lock/edit/Back/pagehide/BFCache/unmount,
reopened new-session isolation, duplicate dispatch, record context switch, all draft clearing, valid
receipt creation/download lifecycle, and write-success/summary-failure distinction. Retain existing staff
capabilities and current price/proof/release/shipment gates without inventing new production approval.
Full Python/Node/typecheck/build/browser regression, headless pixel/WCAG2A/AA and scoped axe; actual
loopbackASGI synthetic staff offer/receipt flow plus lock/reopen verification, no real account/provider.
Owned hidden processes/headless browsers only, verify cleanup and preserve exact frozen evidence for
independent review. No publication ahead of green dependency chain.

### RPG-122 / SS-071 staff-session repair: author evidence

- Repaired the reproduced pending-action/Lock race with immutable staff session and record generations. A retired continuation neither restores private state nor starts an old overview request. Lock hides/forgets this browser session; it does not cancel an already-submitted server action.
- Record reference edits and record changes clear engraving, shipment, pricing/message, readiness and receipt drafts. Synchronous operation guards and stale success/error/finally checks preserve new-session state. Confirmed writes followed by refresh failure are reported honestly, without prompting a duplicate mutation.
- Final author validation: 189 Node tests (36 added), 828 Python tests plus 94 subtests, 53 headless browser tests (4 added), TypeScript and optimized static build passed. Existing backend permissions, endpoints and business gates are unchanged.
- The separately labeled real loopback ASGI smoke exercised staff offer, customer acceptance, staff order creation and private receipt download against a synthetic database. It exposed legitimate null date/quantity fields; the response guard was corrected to the actual backend contract and a regression added before the final build and reruns. No provider or live customer calls were made.
- Final desktop 1440px, mobile 390px and real-backend screenshots were inspected. Whole-page WCAG 2A/AA and all axe rules scoped to the new workspace main content passed; the previously documented global announcement-region best-practice issue remains outside this repair.
- Owned smoke PIDs 8388/12940 and ports 63748/63749 were stopped; browser test port 3140 is closed. Synthetic database and private downloaded receipt were removed by the validated temporary-root cleanup. No user browser was manipulated.
- Evidence remains locally under the worktree artifacts directory and the existing delivery folder. Publication and independent qualification are separate subsequent gates; this is not production readiness or activation.

## RPG-138 / SS-070: bounded component-ledger recovery qualification checkpoint

Base: public main 53b5feba866f0845af474cb96f510728bcaefe93. This independent test-only branch does not depend on or edit the frozen UI stack. Producer: second store lane; independent reviewer/integrator: first store lane. Implementation remains stopped until checkpoint admission.

### Scope and evidence contract

- Extend the existing owned synthetic SQLite drill, not introduce a production backup service. Planned files: tests/unit/test_sqlite_restore_drill.py, optional focused test helper only if needed, services/commerce/RETAIL-TEST.md and this checkpoint/evidence log. No backend, contracts, dependency, workflow or runtime configuration change.
- Retain an explicit legacy fixture profile and add an exact ledger/BOM profile. Each profile uses a fixed table set and exact schema/row expectations; unknown or missing tables remain rejected. Never derive the allowlist from the input database. Preserve schema/index comparison and source/target identity, alias, WAL, sidecar, time/size and non-mutation safeguards.
- Add the ten existing tables: fixture_components, fixture_locations, fixture_lots, fixture_balances, fixture_movements, fixture_boms, fixture_holds, fixture_allocations, fixture_hold_commands and fixture_hold_events. The ledger/BOM profile explicitly includes sqlite_sequence with exact schema and the two independently expected movement/event counters. There is no existing sequence filter or exemption. Counter and orphan sequence-row tampering must fail closed; restored next-sequence continuity and replay non-mutation are tested.
- Seed solely through supported staff fixture APIs with synthetic identifiers: two components, two locations, immutable lots/BOM, receipts and transfer/condition movements, and multi-component reservations in active/released/consumed states. Record deterministic expected quantities, lot versions, allocation states, BOM snapshot and event/command relationships independently before snapshot creation.
- Verify restored conservation (received versus available/damaged/consumed quantities), active allocation floors, component/lot/location/BOM references, immutable BOM snapshot and lot audit/event identities. Check exact command fingerprints/receipts and global movement-versus-hold request identity, not just row counts.
- After isolated restore, replay original movement/reserve/release/consume requests without duplicate stock, allocations, events or version changes; changed-payload replay and stale CAS fail closed. Exercise one eligible new transition on restored state and ensure original source bytes remain unchanged. No checkout authority or real inventory is implied.
- Corrupt and rehash snapshots for missing/orphan component/lot/location, balance/conservation mismatch, allocation state/units, BOM snapshot, command/fingerprint and audit/event relationships. Reject before application open/target creation and preserve source. Keep existing unknown-table, unsafe path, WAL, failure-injection and legacy retail/proof replay cases unchanged in meaning.

### Explicit exclusions and qualification limits

Commercial snapshot tables, Square provider tables, large personalized contexts beyond this bounded fixture budget, populated legacy-proof observations, real private assets, jobs/outbox, schema migrations and production recovery targets/retention remain unqualified. Do not silently whitelist those namespaces or claim full OPS-04/SS-070 acceptance. Hashes establish integrity, not owner authority.

### Gates

Use only owned short D: synthetic pytest temporary roots and existing locked Python; no actual database or real backup/restore, network/provider, AWS/WSL, user browser, deletion of unrelated files or extra workers. Run focused drill and ledger/BOM tests, full Python regression, OpenAPI consistency, archive 67/41, documentation links and diff checks. Freeze clean exact SHA/tree and verified bundle for independent review. Publication is separately coordinated; no retry of queued CI. Implementation stops 02:20 UTC and final cutoff is 03:00 UTC on November 12.

### Ledger/BOM recovery author validation

The admitted sequence correction is implemented explicitly: no sqlite_sequence filtering, and only the two known AUTOINCREMENT counters are accepted for the ledger profile. Twenty-seven new synthetic cases passed; the full Windows suite passed 855 tests plus 94 subtests, including all 57 unchanged legacy drill cases and the existing ledger/BOM behavior tests. Archive 67/41, 31 documentation links, OpenAPI consistency and diff checks passed. One existing Starlette/httpx deprecation warning remains.

Actual synthetic evidence covers committed WAL versus an uncommitted balance edit, three reservation lifecycle states, exact replay with no version/event/counter mutation, shared command-identity collisions, active allocation floor and stale per-lot CAS rejection. A new restored release and receipt continue event IDs at 11/12 and movement ID at 5. Twenty-five rehashed schema/row/counter corruptions are rejected before target creation while preserving the source. No actual database, customer asset, provider or production configuration was accessed. Commercial/Square/large-proof/legacy-observation exclusions remain unchanged. This source is ready for independent review, not yet published or production-qualified.

## RPG-121: unreachable legacy portal cleanup checkpoint

Producer: second store lane; reviewer/integrator: first store lane. Checkpoint is based on frozen qualified staff reconciliation d2316e5da8867ecb7dc725db942be38d1bd4a87b. No implementation before PR21 integration and independent checkpoint admission; rebase this documentation-only checkpoint onto the confirmed identical-tree merged main first.

### Bounded scope

- Remove only the private, unexported and unreferenced LegacyRecordPortal function from apps/storefront/src/components/CustomerPortal.tsx, its exclusively used RecordData type, and now-unused useState and commerce imports.
- The hook-free exported Portal already dispatches every supported kind to ProofReviewPortal, OrderReviewPortal or QuoteReviewPortal. Recheck tracked public source references and exports before deletion; no dynamic or module-level execution was found in the initial audit.
- Preserve the Portal dispatcher, Account implementation and Admin re-export exactly. Preserve Link/useStore/Icon imports and all active proof/order/quote/staff component blobs, shared client, backend, contracts, workflows and business data. No held source, generated bundle or historical reconstruction is involved.
- Add focused regression coverage for all three dispatcher kinds and Account/Admin export availability in the existing routine frontend test entrypoint, without weakening existing behavior assertions. Do not add a replacement portal, new feature, pricing decision or runtime configuration.

### Verification and completion

- Verify exact diff scope, absence of dead references and unchanged retained component bodies. Run the complete Python suite (baseline 855 tests plus 94 subtests), existing Node suite (baseline 189 plus new regressions), optimized static build, TypeScript, 53 headless browser cases, archive 67/41, OpenAPI consistency, documentation links and diff checks.
- Rerun the four existing real loopback ASGI synthetic smokes on the final build: proof, isolated Square adapter-stub checkout, quote acceptance and staff workspace. No provider or live customer calls. Inspect resulting pixels and verify all owned helpers, ports and short temporary fixtures/receipts are cleaned up.
- Use existing locked dependencies and owned D: work paths only. Never touch the user's browser, unrelated processes, AWS/WSL, production services or held sources. No new helpers/agents.
- Freeze a clean exact commit/tree and verified bundle for independent review. No push or merge before that gate and parent integration authorization. This removes technical debt only; it neither adds commerce capability nor qualifies production readiness. Implementation stop remains November 12 02:20 UTC and final cutoff 03:00 UTC.

### Portal cleanup author validation

Removed 416 unreachable lines: the private legacy portal, its data type and unused React/commerce imports. The active three-way dispatcher, Account body, Admin export and all active portal/staff/backend sources remain unchanged. Two new routine Node regressions check exact dispatch/export identities and parsed-source absence of the retired declarations/import authority.

Final Windows validation passed 855 Python tests plus 94 subtests, 191 Node tests, 53 headless browser cases, optimized static build, TypeScript, archive 67/41, 31 documentation links, OpenAPI consistency and diff checks. All four separately labeled real loopback ASGI smokes passed on this build; Square uses only the existing isolated test adapter stub and intercepted navigation, never a provider call. Fresh proof/order/quote/staff screenshots were inspected without a layout regression. Owned helper PIDs 9332/22516/4276/3332/35772/17372/22412/24072 and ports 3145/55217/55218/57083/57084/53171/53172/50177/50178 were verified absent/closed; synthetic temporary databases and downloaded receipts were removed by existing guarded cleanup. Exact source is ready for independent review, not published or production-qualified.

## RPG-138 / SS-070: bounded personalized and legacy proof recovery checkpoint

Producer: second store lane; reviewer/integrator: first store lane. Documentation-only checkpoint on qualified cleanup source 9829de2c3a24501c1c7d95d545e21be7176e5ce1. Implementation must wait for cleanup integration, transplantation onto confirmed identical-tree main, and independent admission.

### Scope and independent expectations

- Add an explicitly selected ProofDrill fixture profile in tests/unit/test_sqlite_restore_drill.py using exactly the existing eleven TABLES and unchanged one-MiB snapshot budget. Preserve all 84 existing legacy and ledger/BOM cases and their expectations. Keep existing False/True profile mapping explicit; unknown request.param values must not silently select a new fixture.
- Seed only small synthetic personalized orders through supported offer/cart/order/proof APIs, covering explicit identical and per-piece mappings with independent piece count versus stock units. Establish expected indices, inscriptions, quantities, totals, context identity, revision wording, decision comments and row counts independently before creating the snapshot; do not treat copied observed rows as the semantic success oracle.
- Build legacy state first in this isolated owned fixture before any modern proof history. Clearly labeled direct synthetic database shaping may remove binding metadata and evidence tables as the existing legacy regression does; never drop histories from the mixed baseline fixture or touch a real database. Supported prepare/read/decision APIs then establish the legacy observation and newly bound revision.
- Verify the observed legacy document retains its original unbound wording and lacks invented context/approval. Version one remains unavailable as bound history; only the freshly prepared revision two receives actual context and any subsequently submitted decision. Preserve truthful captured versus historical timestamps and identities.
- Qualify exact eleven-table schemas and rows, context byte/hash integrity, personalized mapping/order/line consistency, proof/order/revision/decision references and legacy observation identity. Retain source path/alias/sidecar/time/size protections and unknown-table rejection; never broaden a whitelist from input contents.
- Restore only into an owned new synthetic target. Exercise authenticated history and exact decision replay, verify no duplicate evidence/events/version changes and no manufactured version-one approval; preserve original source bytes. Rehash deliberately corrupted mapping, context, observation, reference, version and decision snapshots and reject before target creation/application use.

### Limits and gates

This is fixture qualification, not a runtime migration or production recovery command. No actual database, customer artwork, private assets, provider, account, AWS/WSL or deployment. Commercial/Square recovery, contexts above the unchanged one-MiB drill budget, general legacy migrations, jobs/outbox and production recovery targets remain explicitly unqualified.

Planned source scope is the existing drill test plus services/commerce/RETAIL-TEST.md and this evidence log. No backend, contract, CI or UI changes. Run focused new and all 84 existing drill cases, full Python regression, archive 67/41, documentation links, OpenAPI consistency and diff checks. Use existing locked Python and owned short D: temporary roots. Freeze clean exact SHA/tree and verified bundle for independent review before publication. No additional agents; implementation stop November 12 02:20 UTC, final cutoff 03:00 UTC.

### Personalized/legacy proof recovery author validation

Added 27 synthetic cases: one complete personalized/legacy roundtrip, eighteen resealed corruption cases, and eight rejected ambiguous/unknown profile selectors. Existing 84 drill case bodies remain unchanged. Explicit False/True selection retains the original legacy and ledger profiles; the new named profile uses exactly the original eleven tables and one-MiB budget.

Independent fixture expectations now include accented and supplementary Unicode inscriptions, canonical UTF-8 bytes/hash from separately specified item/line/mapping/totals, pieces-per-item two versus stock consumption three, truthful original/capture/revision/decision clocks, and retained unbound original wording without invented version-one approval/history. Restored original personalized cart/order receipts and exact decisions replay without state mutation; changed inscriptions or decision comments are rejected. Snapshot corruptions fail before creating the target and original source bytes remain unchanged.

Final Windows full suite passed 882 tests plus 94 subtests; focused drill coverage totals 111 cases. Archive 67/41, 31 documentation links, OpenAPI consistency and diff checks passed. A profile-local timestamp assertion initially used the wrong field name; it was corrected to the actual recorded_at contract before final reruns. No runtime sources, providers, actual data or production recovery operations were touched. Large contexts, commercial/Square recovery, private assets and general migration/production recovery guarantees remain unqualified. This clean source is for independent review, not yet publication.

## RPG-121 / SS-013.AC2: private customer order-summary checkpoint

Producer: second store lane; reviewer/integrator: first store lane. Docs-only checkpoint on frozen recovery 0c9b1aacbc159e31be579b4f4b4c1eff14ee328a. No implementation until recovery integration, transplantation onto confirmed identical-tree main and independent admission.

### Exact bounded customer outcome

- Add a local Download order summary action to the existing public OrderReviewPortal only. The file is a plain UTF-8 text summary of the authenticated server order, explicitly not a paid receipt or tax invoice. Show actual unpaid/paid/reconciliation status verbatim, without claiming booking, manufacturing approval or a payment event. A null total remains not yet quoted, never zero or a guessed price.
- Reuse existing immutable session/id/generation and synchronous operation lock. Capture current validated order and version, GET that same order with the captured capability, validate the returned identity/version and exact whitelisted displayed material/status fields before creating a file. If changed, show an honest refresh/review instruction and require a fresh action; do not silently download materially different terms or stale payment status.
- Construct a fresh explicit allowlisted projection: order reference/version, order/payment/proof status, total_minor/currency or unquoted state, product_slug/quantity rows, customer-visible next step, bounded timeline labels/times and shipment carrier/tracking when present. Never serialize the raw response or spread unknown fields. Exclude access codes/tokens, customer/contact/profile details, staff notes, supplier costs, generic hidden fields and internal provider metadata. No client-side price calculation or personalization reconstruction.
- Keep text Unicode-safe and bounded using existing response validation; output plain text rather than HTML, CSV or executable markup. Use a constant safe filename prefix plus a sanitized bounded reference, with no path construction from server data. Explain the locally downloaded file may contain private order details and remains on the customer's device after Close.
- No network operation except the existing authenticated order GET. No new backend, account, payment, checkout eligibility, provider, shared-client or production authority. Preserve proof/quote/staff/Account/Admin sources and active Square URL/gate logic.

### Lifecycle and verification

- Close, credential edits, Back/pagehide, persisted BFCache and unmount invalidate the operation before Blob/link creation or click. Ignore retired success/error/finally callbacks. Block duplicate download clicks and concurrent checkout through the existing synchronous lock; a refused/error/changed response creates no file. Never claim a browser save completed merely because the download was initiated.
- Track and revoke owned Blob URLs after use and on dismissal/unmount/failure without revoking unrelated URLs. Remove temporary anchor elements. No capability in filenames, file content, DOM hrefs, local/session storage, logs or analytics.
- Extend routine order Node tests with allowlist/secret injection, exact id/version/material/status parity, null total, full bounded Unicode, duplicate clicks, all stale lifecycle cases, failures/retry and Blob cleanup. Add actual headless browser download-content and mobile/keyboard/accessibility checks. Extend existing isolated real-ASGI order smoke to refresh/download actual synthetic order data; keep existing Square adapter stub/navigation interception and no provider calls.
- Run full Python baseline 882 plus 94 subtests, Node baseline 191 plus new cases, build/typecheck, full browser baseline 53 plus new cases, all four existing real-ASGI smokes, archive/contracts/links/diff and fresh pixel inspection. Clean owned hidden helpers/ports and synthetic artifacts safely. Freeze exact clean source/bundle for independent review before publication.

No held source, user browser, live customer data, provider, deployment, AWS/WSL or additional agents. This is a local order summary, not full invoicing, refunds, accounting or payment-receipt functionality. Implementation stops November 12 02:20 UTC; final cutoff 03:00 UTC.

### Plaintext integrity admission clarification

Exported untrusted field values must visibly encode Unicode formatting controls (including bidi marks/overrides/isolates), U+2028 and U+2029 rather than letting them alter line boundaries or payment/status labels. Existing validation alone is insufficient because it permits those characters. Preserve ordinary accented and supplementary Unicode text. Regression cases must show hostile field values cannot forge separate labels while valid names remain intact. Construct only the positive allowlisted projection, never the cast raw record. On any refreshed same-version material or status change, update the displayed validated record, create no file and require another explicit click. Filename uses a fixed safe pattern derived only from the captured validated order reference, never its access code.

### Order-summary author validation

Implemented a local plain-text order-summary download using a fresh authenticated GET and exact allowlisted version/material/status comparison. Changed responses update the display and require a new click; stale lifecycle callbacks, duplicate requests and interleaved checkout cannot create an unverified file. The export excludes capabilities, hidden metadata and unknown fields, visibly encodes formatting/bidi/line-separator controls, preserves ordinary Unicode, formats recorded USD cents exactly and labels null totals unquoted. It explicitly is not a paid receipt or tax invoice and reports download requested rather than claiming a completed browser save.

Final Windows author gate passed 882 Python tests plus 94 subtests, 219 Node tests (28 new), 56 headless browser cases (3 new), optimized build, TypeScript, archive 67/41, 31 documentation links, OpenAPI consistency and diff checks. Four real loopback ASGI smokes passed; the order smoke verified actual downloaded unpaid data and exact USD 12.34, then preserved the existing isolated Square adapter-stub/intercepted navigation behavior. No provider or live data was accessed.

An initial browser assertion matched both the new status notice and the pre-existing global toast; it was scoped correctly. A synchronous-dismissal Node assertion stalled while formatting an intermediate React/JSDOM element; explicit async act and boolean absence assertions fixed the harness. The post-click active-session guard and ES2017-compatible BigInt constructor formatting passed final reruns. Earlier failed/incomplete logs remain distinct from final evidence. Test screenshot capture now scrolls instantly before capture to avoid smooth-scroll sticky-header artifacts; runtime styling is unchanged.

Final desktop and 390px mobile screenshots were inspected. Owned final helper PIDs 22548/19956/35460/28616/35768/20196/9360/16300/9044/31536 and ports 3146/50623/50624/50888/50889/57553/57554/60422/60423/51929/51930 were verified stopped/closed; guarded smoke cleanup removed synthetic databases and private temporary downloads. All active non-order components, backend/shared client/contracts and checkout gates remain unchanged. Source is frozen for independent review, not yet published or production-qualified.


## 2026-11-11 RPG-121 cross-portal synthetic integration checkpoint

- Producer: second store worker; independent reviewer/integrator: store coordinator. Existing-card qualification, not a new customer feature.
- Base: frozen order-summary bd8fbde3; preserve it unchanged. Transplant this docs-only checkpoint onto verified same-content merged main before implementation; independent admission required.
- Scope: one new local real-ASGI/headless-browser integration smoke and focused test/documentation wiring only. Preserve existing four smokes, all application components, backend, shared client/contracts and provider gates unchanged.
- One owned temporary SQLite database and loopback ASGI app; seed a synthetic initial request through the existing qualified API, never held guided-design/rollup UI or real accounts/customer data.
- Browser staff session opens the seeded request and offers a bounded synthetic quote; private customer quote session reads and accepts those exact terms/version.
- Staff browser creates the linked order and obtains the existing private receipt; use that capability only in memory for customer order lookup and refreshed order-summary download.
- Assert downloaded allowlisted contents match the server order and remain explicitly unpaid/not a paid receipt/not a tax invoice; no token, capability, private staff fields or unknown properties in file.
- Staff browser prepares a bound proof and receives its private capability; customer browser reads the current bound evidence and approves that exact revision and context.
- Verify the same database/order links, material configuration, quote accepted version, order identity, proof identity/version/context and resulting decision through the supported APIs.
- Proof acceptance is not payment, booking or production permission: assert unpaid production hold persists, and a production-release attempt remains denied without changing state.
- Negative coverage: wrong-token and cross-order/proof capability combinations deny access and do not mutate state; no identity handoff inferred from a prior portal session.
- Exercise private Close/navigation between stages, assert prior records/receipts/forms disappear and cannot supply authority to another stage; capability handoff is explicit and in-memory only.
- Never log fixture secrets/capabilities or capture private receipt panels in retained screenshots. Only safe aggregate assertions/results and sanitized synthetic screenshots retained.
- No provider calls. The integrated unpaid path needs no checkout; if existing Square smoke is rerun it keeps its isolated process-only adapter stub/navigation interception.
- Own all helpers, ports, browser contexts and temporary paths; hidden Windows processes, headless browser, short owned temp root, safe path checks and final PID/port/temp cleanup verification.
- No production/customer/account/role changes, no live purchases, deployment, AWS/WSL, held sources or further workers.
- Verification after implementation: full Python/Node regressions, optimized frontend build/typecheck, current browser suite, four original actual-ASGI smokes unchanged, new cross-portal smoke, archive/OpenAPI/doc links/diff checks and fresh safe pixel inspection.
- This qualifies a synthetic local connected path, not real provider fulfillment, real household login, hosted browser deployment, inventory qualification or launch readiness. Report any uncovered boundary honestly.
- Stop implementation at 02:20 UTC; final cutoff 03:00 UTC. Freeze exact clean source and verified bundle for independent review before any publication.

### Cross-portal connected-state witness refinement

- Retain one explicitly authenticated customer order tab after its first unpaid/awaiting-proof summary as an intentional stale-state witness. Use a separate explicitly authenticated proof tab with its own supplied capability, never inherited order authority.
- After the proof tab approves the exact bound revision, return to the retained order tab. Assert the actual order version remains unchanged while its proof status changes.
- The first subsequent summary click must refresh and reveal the changed proof status, produce zero downloads and require a new explicit click. The second click must export the approved-proof status while still explicitly unpaid/not a paid receipt/not a tax invoice.
- Close quote/proof sessions and staff private receipt panels at stage boundaries; the order witness is the sole intentional retained session and is closed at the end.
- Assertions involving capabilities, tokens or private receipts must compare booleans or redacted safe projections. Never pass raw private values/objects to equality/deep-equality assertions whose failure formatting could disclose them. Retained screenshots occur only after private receipts are dismissed.

### Cross-portal routine CI wiring admission

- Additional scoped paths: root package.json adds test:cross-portal invoking the new tests/frontend/cross-portal-real-smoke.cjs; .github/workflows/verify.yml storefront job runs it after existing build/browser installation and e2e checks.
- Use the same pinned actions/setup-python SHA and Python 3.12 as the preservation job, install the existing unchanged requirements-dev.lock, and set CROSS_SMOKE_PYTHON to that job's resolved python executable plus an owned runner-temp root.
- Existing storefront invalid QA origin and all existing checks, timeouts, permissions, secrets and provider-disabled fixture gates remain unchanged. No new provider/service credentials, package dependencies, runtime test backdoor or weaker checks.
- Independent admission is required before editing workflow/package wiring. Native equivalent command qualifies locally; hosted CI remains a separate exact-head publication gate, never presumed passed.

### Cross-portal implemented qualification and remaining limits

- Added tests/frontend/cross-portal-real-smoke.cjs and test:cross-portal command. Set CROSS_SMOKE_PYTHON to the locked interpreter and CROSS_SMOKE_TEMP to an owned short temporary root; build with the existing invalid QA API origin first. Routine storefront CI installs the unchanged locked Python requirements and runs this command after browser checks.
- One loopback ASGI DB now connects real browser staff quote offering, customer exact acceptance, staff order receipt, customer order-summary download, staff bound-proof receipt and customer approval. Private receipts are read from download streams in memory, not printed; download artifacts are explicitly deleted.
- The retained order tab witnesses a real proof-status change at unchanged order.version: first refresh produces no file and requires review, second explicit download includes approved proof and still-unpaid payment status.
- Exact wrong/cross-order capabilities receive the existing private-record 404 without observed order mutation. A legacy quote order's release returns its existing durable inventory/capacity migration 409, with unchanged order state. This does NOT isolate payment as the sole denial cause or qualify legacy production release.
- Private assertions use booleans/redacted projections and failures report only a bounded static stage/HTTP status, never raw exception details, private bodies or capabilities. Final screenshots are taken after private panels are closed. Storage checks assert absence of private capabilities/record identities, not absence of unrelated public UI state.
- Original four actual-ASGI smokes and all application/backend/client/contract sources remain unchanged. No checkout/provider call is part of the new path, and no real household, account, customer or production data is involved.

- Final isolation guard authenticates an exact empty /v1/admin/summary with a fresh random staff nonce and checks owned backend liveness before seed POSTs. Ambient provider variables are removed only from child-process environment, never saved credentials/settings.
- Wrong-capability and rejected-release batches additionally compare an internal read-only logical hash of the entire owned SQLite fixture; neither rows nor hashes are logged. Supported order-view assertions remain.
- Author verification: 882 Python tests plus 94 subtests, 219 Node tests, 56 browser tests, optimized build/typecheck, archive 67/41, OpenAPI and 31 documentation links passed. All four unchanged real-ASGI smokes passed; final new cross-portal smoke passed 22 real relayed requests, same-version no-download/second-click behavior, exact migration denial and whole-fixture nonmutation, followed by owned cleanup.
- Fresh closed-session desktop pixels inspected with no private fields/receipts present. Local YAML parser package was unavailable; workflow was inspected against the existing pinned action/step structure, and hosted exact-head CI remains required, not yet claimed.

- Final network hardening: the new browser context blocks service workers and aborts/counts every origin outside the owned UI and relayed invalid QA origin, requiring zero outside attempts. Node HTTP requests reject redirects. Cleanup verifies socket refusal (ECONNREFUSED) rather than treating arbitrary HTTP/fetch errors as closed ports. Final cross-smoke passed with 22 relays and zero outside-origin attempts; prior f1ed68c bundle is preserved as superseded pre-hardening evidence.

- Cleanup correction: skip exited/signaled children; never terminate a missing/noninteger PID. Browser-close failure does not prevent attempts to stop every owned server. Unknown/open ports or unverified server termination preserve the temporary fixture and fail qualification; cleanup failures are reported only as static categories. PASS is emitted only after all cleanup succeeds. Corrected smoke again passed 22 relays/zero outside attempts with closed owned ports and removed fixture; d807e6c evidence is superseded and preserved.


## 2026-11-11 RPG-137 bounded DOM failure diagnostics checkpoint

- Producer: second store worker; reviewer/integrator: store coordinator. Separate branch based on frozen cross-portal 798f841; preserve that branch and its evidence. No successor publication/merge before cross-portal green integration.
- Scope only five already-wired tests/frontend files: storefront.test.cjs, proof-review.test.cjs, order-review.test.cjs, quote-review.test.cjs and staff-session.test.cjs, plus this evidence document.
- Read-only TypeScript AST audit found exactly 54 direct DOM query assertions with null expected: 4 storefront, 15 proof, 10 order, 13 quote, 12 staff. Five non-DOM storage/readLocal null checks are excluded.
- Transform only assert.equal(query, null[, message]) into assert.equal(query === null, true[, message]); preserve exact query expression and optional message, with no Boolean/falsy relaxation. Actual undefined, false and live elements must still fail; only null passes.
- Add a focused AST inventory/original-intent qualification: independently retain the 54 expected file/query/message descriptions and compare each converted strict-null expression, while verifying the five non-DOM null checks remain unchanged. No broad reformat or runtime code changes.
- Add qualification inside an already-wired Node test file, without new dependencies or CI/package wiring: spawn a bounded child with existing React/JSDOM libraries, render a real element holding a random env-only secret sentinel in DOM props, then deliberately fail the strict-null boolean assertion.
- Require nonzero child exit without timeout/signal termination, prompt completion and absence of sentinel in captured stdout/stderr. Parent failure assertions use booleans, never echo child output, secret or live DOM. Companion missing-query-null success and undefined failure prove exact semantics.
- Child process has a hard timeout/kill boundary so a hypothetical synchronous inspector hang cannot consume the run indefinitely. Its fixture source uses process.env for the random sentinel rather than embedding it in source/error text; no actual credentials or customer data.
- Preserve all application/runtime/backend/shared client/contract files, locks, workflow, existing assertion meaning and cross-portal/four ASGI smoke files. No production data, providers, held sources, new workers or deployment.
- Planned gate: routine full Node suite including new diagnostics qualification, full Python regression, existing optimized build/typecheck/browser suite and cross-portal integration, archive/OpenAPI/doc links/diff checks. Independently review exact source/AST delta before any publication.
- Docs checkpoint requires independent admission before edits. Stop implementation 02:20 UTC, final cutoff 03:00 UTC; report genuine failures and cleanup rather than claiming a timed-out test passed.

### DOM diagnostics author verification

- Converted exactly 54 AST-selected direct DOM/null assertions; original query and optional message bytes are retained, with strict === null comparisons. Five non-DOM storage/readLocal null assertions remain unchanged. The fixed query/message inventory hashes match the pre-change source and routine tests enforce them.
- Added five routine tests: exact AST inventory, plus separate bounded real React/JSDOM subprocess cases for missing/null success and undefined/false/live-element failures. Random sentinel is supplied only through child environment and stored in DOM props; failures exit normally and promptly without sentinel disclosure. Parent assertions never print captured child diagnostics or private values.
- Author gate passed: 224 Node tests (219 existing plus 5), 882 Python tests plus 94 subtests, optimized build/typecheck, 56 browser tests, unchanged cross-portal actual-ASGI smoke (22 relays, zero outside-origin attempts), archive 67/41, OpenAPI and 31 internal documentation links. Owned cross-smoke processes/ports and preview port were verified closed; temporary fixture removed.
- No runtime/backend/shared-client/contracts/workflow/package/lock or existing smoke changes. This improves failed-test diagnostics and privacy, not customer-facing functionality. Stacked publication remains blocked until predecessor integration and independent review.


## 2026-11-11 RPG-122 / SS-071.AC2 recorded personalization display checkpoint

- Producer second store worker; independent reviewer/integrator store coordinator. Root admitted bounded display preparation on frozen diagnostics d2b5882; preserve all predecessor branches/bundles. No successor publication before predecessor green integration and combined-tree review.
- Verified public source: StaffWorkspace currently renders only items.product_slug/quantity/text; retail.py records lines[index].personalization_snapshot; piece_personalization.py defines exact normalized schema. Customer ProofReviewPortal already consumes this mapping, but staff cannot inspect it.
- Scope: StaffWorkspace integration with one small independently testable read-only display/validator component if useful, already-wired staff Node tests, focused browser/actual-ASGI synthetic QA and evidence docs. No backend/shared-client/API/provider/payment/permission changes; no held guided-design/rollup/source, real names/accounts or manufacturing activation.
- New staff section is labeled Recorded personalization, never approved manufacturing instructions. Display authoritative normalized mapping, with human-readable line/set/piece numbers clearly derived from stored zero-based indices; show identical versus per-piece mode without inferring physical count from stock units.
- Exact snapshot fields: schema_version=1, mode identical/per_piece, line_index, quantity, pieces_per_item, pieces[{set_index,piece_index,text}]. Strict safe integer/type checks reject booleans/strings/coercion, unknown snapshot fields, wrong line association or quantity, and invalid/missing/duplicate positions.
- Match each snapshot to the same indexed order item and line.item product/quantity/structured personalization. Explicit pieces_per_item 1..100; quantity 1..500; exactly quantity*pieces_per_item mapped positions, at most 500 per line and 2000 per order. Up to 100 item lines; same SKU on different lines must stay separate. Never use stock_units as piece count.
- Structured request mode/text or per_piece assignments must agree with normalized snapshot (compare positions/text, allowing request input ordering but requiring canonical normalized order). Identical mode must repeat exactly the recorded request text; per-piece input must have exactly the same complete assignment set.
- Absent structured data/snapshot is explicitly legacy/unqualified, not inferred. Present structured data with missing snapshot, orphan snapshot on legacy item, malformed snapshot or disagreeing fields shows a reconciliation warning and no misleading partial mapping or generic-text fallback. Existing action/backend gates stay unchanged.
- Legacy text/secondary/font/options remain readable where valid under their existing contract; no fabricated per-piece allocation. Newly rendered bounded text follows actual Python code-point limits (120 inscription, supported font enum, options <=16 keys<=60/value<=200); preserve ordinary accents, supplementary characters and meaningful whitespace. Reject malformed surrogate data; isolate/visibly label formatting controls where needed to prevent misleading row labels, never innerHTML.
- Paginate at most 25 mapped rows, no automatic material downloads, no new storage. Explicit line/product/set/piece context remains visible across pages. Reset display pagination when record/session changes; Lock/ref edit/Back/BFCache/unmount and late response guards remain authoritative, clearing private mapping with existing record state.
- Planned tests: identical/per-piece/mixed legacy, same-SKU multi-line isolation, reversed request assignments versus normalized order, all duplicate/missing/out-of-range/count/version/type/hashless identity disagreements, 500-per-line/2000-total boundaries and >bounds rejection, full valid Unicode/whitespace and hostile markup, pagination reset and stale/locked sessions.
- Actual-ASGI fixture creates qualified synthetic offer/cart/order via existing APIs with pieces_per_item distinct from stock units, then staff browser reads real mapping without changing it. Safe screenshot only synthetic content, no private receipts/capabilities; headless mobile/keyboard/axe/overflow and exact pixel inspection required. No provider calls; owned process/port/temp cleanup.
- Full Node/Python/build/typecheck/browser/archive/OpenAPI/link gates and connected cross-portal smoke must remain green; no full SS-071 role/cost/file/audit acceptance claim. Freeze exact source for independent review, no publication before admission. Implementation stops 02:20 UTC; final cutoff 03:00 UTC.

- Schema clarification: raw per_piece request arrays may be in any order; compare their position/text set against canonical line snapshots sorted by set_index/piece_index, not raw array order. Explicit null personalization, competing nonempty legacy text/secondary, or structured options outside Crystal shape/Size/Orientation are invalid. Structured inscriptions reject Cc/Cs while retaining valid whitespace/Unicode. Render only explicit display fields; never dump notes, costs, provider fields or entire objects.

### RPG-122 / SS-071.AC2 recorded personalization implementation and qualification
- Added a bounded read-only RecordedPersonalization consumer and replaced only the old staff item summary. Staff actions, session lifecycle, backend, customer portals, provider gates, contracts, workflow and package wiring are unchanged.
- Independently explicit piece count, positional same-SKU line identity, raw-request normalization and exact canonical snapshot parity are required. Missing legacy allocation is labeled separately from malformed evidence; malformed evidence displays reconciliation rather than partial names or inferred manufacturing permission.
- Preserves supported legacy multiline/Unicode inscriptions, secondary text, font and options. Structured inscriptions retain their stricter existing control-character rules. Hidden fields are never dumped; format/bidi controls are visibly encoded. At most 25 of the bounded 2,000 recorded assignments render per page.
- Author gate: 268 Node tests (44 new), 882 Python tests plus 94 subtests, optimized build, TypeScript, 59 Playwright cases (3 new), archive 67/41, 31 active-document links, OpenAPI and diff checks passed.
- New actual-ASGI staff smoke uses an isolated synthetic retail fixture: two same-SKU lines, 60 recorded pieces versus 210 stock units, reversed raw per-piece order, desktop/mobile keyboard pagination and scoped all-rule axe, immutable order and Lock clearing. Two relayed reads and zero external-origin attempts. Existing cross-portal, proof, order-stub, quote and staff actual-ASGI smokes also passed unchanged.
- Owned fixture identity was verified with fresh staff nonce and exact empty authenticated summary before writes. Child provider environment stripped; network origins closed; failure output redacted; owned browser/server cleanup and closed ports verified. No live provider, customer, production activation or deployment. New smoke is local qualification only, not silently added to CI.
- Final actual desktop/mobile screenshots inspected: artifacts/staff-pieces-real-desktop.png and artifacts/staff-pieces-real-mobile.png; no introduced clipping or horizontal overflow. Existing brand layout retained.
- Initial malformed browser fixture accidentally aliased request/snapshot piece arrays; corrected the test to corrupt independent snapshot line_index. This was a test-oracle defect, not a demonstrated runtime defect. Final corrected browser suite passed.
- Logs and QA derivatives retained in the existing D: delivery folder (staff-pieces-* and pieces-final-*). Original active source snapshots and predecessors remain preserved. This closes only the bounded display slice, not the entire staff card or production qualification.

### Staff personalization independent-review correction
- Independent review found JavaScript trim removed U+FEFF while Python inscription validation accepts it as nonblank. Replaced display-only blankness with the exact Python whitespace codepoint set, retaining existing control/surrogate rejection and unchanged stored text. Paired Python-model/Node regressions cover BOM, zero-width space, ordinary Unicode and rejected whitespace/controls.
- Added a visible legend explaining that formatting controls appear as \u{CODE}, stored text is unchanged, and operators must not engrave the display codes. No backend, permission, provider or manufacturing semantics changed.
- Corrected final author gate: 269 Node, 883 Python plus 94 subtests, build/TypeScript, 59 browser cases, all six actual-ASGI smokes, archive67/41, links31, contracts and diff passed. Corrected desktop/mobile pixels inspected; owned process IDs and listening ports absent after cleanup. Prior 10e0288 retained as superseded review evidence.

### November 12: RPG-121 / SS-013 private customer recorded inscriptions checkpoint
- Producer: second store lane; independent reviewer: coordinating store lane. Base is approved public main 0531e576. This is a bounded customer order display/summary slice, not completion of the broad customer account or manufacturing configuration criteria.
- Scope: OrderReviewPortal.tsx plus a new customer-only inscription projection/view module, focused already-wired Node tests, browser tests, a local synthetic ASGI smoke and evidence docs. Reuse the exported public recordedPersonalization validator from RecordedPersonalization.tsx unchanged. Do not render its staff component, which includes arbitrary options.
- First validate the full raw items/canonical lines through that strict existing validator, then construct a new positive customer projection: line, product slug, quantity, known font, identical/per-piece mode and exact set/piece inscription rows; legacy primary/secondary text/font only. Structured font comes from the already-validated matching item, not from unknown metadata. Drop all arbitrary options, notes, supplier/cost/provider fields, capabilities and file metadata.
- Replace OrderReviewPortal's raw-object cast with explicit known order/status/items/history/shipment fields plus this validated projection. Keep all currently supported order fields and existing backend/session/payment contract unchanged. Absent items/allocation stays explicitly unknown; empty and legacy states do not invent assignments. Invalid, mismatched, null or orphan structured data fails closed with a safe reconciliation error, not partial invented mapping.
- Respect existing validator bounds: at most 100 items, 500 assigned pieces per line and 2,000 total; quantity up to 500 and explicit pieces per item 1..100 independent of stock consumption. Preserve same-SKU positional line identity, canonical set/piece order, duplicate inscription text and request-order normalization. Display at most 25 assignment rows per page; reset on changed record, Close, navigation and new private session.
- UI preserves valid Unicode, whitespace and legacy multiline inscriptions using React escaping, pre-wrap and isolated text. Visible formatting-control codes need an explicit legend that the stored inscription is unchanged and these codes must not be engraved. Inscription-only display is not proof approval, manufacturing permission or a complete production configuration.
- Extend summary refresh equality to every new customer-visible inscription/font/mode/assignment field. Same-version changes must refresh the display and create no file until another explicit click. Hidden metadata must neither leak nor create false material changes. Canonical raw assignment reordering with identical verified meaning is not a material change.
- Plaintext summary must quote/escape each new untrusted text field unambiguously, including LF/CR/tab, quotes, backslashes, bidi/format controls and Unicode line separators; an inscription cannot forge a separate payment/status label. Preserve ordinary accented/supplementary characters and explain escaped presentation. Never serialize the raw order. Existing unpaid/status/not-receipt/not-tax-invoice and local-file privacy labels remain.
- Keep immutable session/generation/record binding, Close/edit/Back/BFCache/unmount isolation, synchronous duplicate locks, summary/checkout interleaving, Blob/anchor cleanup and exact Square sandbox URL/provider gates unchanged. No new storage, auth, payment, backend/API, supplier or production behavior.
- Test strict mapping parity, identical/per-piece and legacy fonts/secondary text, same-SKU lines, missing/malformed/orphan snapshots, Unicode/BOM/markup/control-label injection, largest bounded pagination, hidden-field exclusion and same-version material refresh versus hidden-only changes. Test interrupted/repeated downloads and Close/navigation with no stale inscription return. Do not reintroduce DOM-object assertion formatting or weaken existing diagnostic inventory.
- Qualification: full Node/Python regression, optimized build/typecheck, existing browser suite plus new mobile/keyboard/axe cases and actual pixel inspection; one owned loopback ASGI structured-order customer lookup/download flow with duplicate SKU lines and stock units distinct from pieces, denied cross-capability access and no mutation. Preserve existing smoke scripts, no new CI wiring without separate admission. Reuse locked dependencies; hidden owned helpers, isolated synthetic DB, provider env stripping, exact owned-server verification, no external requests, static redacted failures and verified process/port cleanup.
- No actual customer data, commercial values, credentials, provider calls, deployment, AWS/WSL, held guided-design/rollup/bundle source or derivatives. No edits to denied history/recovery or webhook producer. No source implementation before independent checkpoint admission; no publication before independent exact-source qualification. Authorization ends November 13 at 03:00 UTC (20:00 Arizona); preserve honestly if incomplete.

### Customer inscription implementation and qualification
- Added a customer-only positive projection/view using the unchanged approved recordedPersonalization validator. OrderReviewPortal now constructs a known-field object instead of retaining a raw response object. Customer display and export omit arbitrary options, notes, provider/cost/internal data, capabilities and file metadata; this is inscription-only information, not manufacturing configuration.
- Boundary: the unchanged private GET /v1/orders endpoint still returns the stored record. This slice minimizes retained React state, rendered DOM and downloaded output, not API/network response data. Backend response minimization remains a separate open task before real-customer activation; synthetic qualification does not establish production account ownership.
- Same-version changes to exact inscription/font/mode/assignment projection refresh the visible record and require another explicit download click. Canonically equivalent raw assignment ordering and hidden-only metadata changes are not material. Legacy multiline values are quoted and escaped in the summary, including control/format characters, so customer text cannot forge payment labels.
- Final qualification evidence is retained in the dedicated D: delivery folder: full Python 883 tests plus 94 subtests, full routine Node suite, optimized build/typecheck, all 62 browser cases including three new customer cases, seven actual loopback ASGI smoke flows (six unchanged regressions plus the new customer structured-order flow), archive 67/41, 31 links, OpenAPI and diff checks.
- Actual customer smoke used two same-SKU lines, 60 canonical pieces and 210 independent stock units, exact complete downloaded assignment text, wrong-capability denial, unchanged order, Close-cleared fields, mobile keyboard/pagination and scoped desktop/mobile axe. It made two relayed authenticated reads, zero outside-origin attempts; all owned helper processes/ports and fixture files were verified cleaned.
- Inspected final desktop/mobile screenshots from the actual backend flow after correcting a screenshot-only sticky-header/focus artifact by blurring and capturing from page top. Final product layout has no horizontal overflow or inscription overlap; no global CSS change was needed.
- Existing shared validator, staff/proof/quote consumers, backend/client/contracts/CI and other pending branches remain unchanged. No provider call, live payment, production receipt, deployment or full SS-013 acceptance is claimed.

### Customer inscription browser oracle correction (2026-11-12)
- Independent review of 16039793 passed 883 Python tests plus 94 subtests, 296 Node tests, 17 external probes, build/typecheck and preservation/contracts/links checks, but its browser run passed 61 of 62: the new malformed-snapshot test matched both the visible safe-error alert and Next.js's empty route announcer.
- Corrected only that new assertion to filter the alert role by the expected safe-error text. Both no-inscription/no-download assertions and every existing test prefix remain unchanged. This was test locator ambiguity, not a reproduced runtime failure.
- Fresh complete browser runs passed 62/62 twice (exit 0), with the owned 3158 preview listener closed after each run. Logs: customer-inscriptions-corrected-browser-1.log and customer-inscriptions-corrected-browser-2.log in the existing D: delivery directory.
- All runtime blobs are byte-identical to 16039793. The original freeze and bundle are retained as superseded evidence; this correction does not extend API/network-redaction claims or authorize publication.
## RPG-122 / SS-071.AC2 staff recorded-history display checkpoint
- Producer: second store lane; independent reviewer/integrator: parent store lane. This is an existing-card bounded read-only consumer, not a new audit authority.
- Base: frozen reviewed-candidate mapping 025af63; predecessor must integrate normally and this checkpoint must be independently admitted before implementation/publication.
- Verified accessible backend workflows.event appends timeline entries with label and at; NOW emits timezone-aware ISO strings. OrderReviewPortal already consumes these fields; StaffWorkspace has no recorded-history view.
- Scope: a new small staff-only history component plus minimal StaffWorkspace integration; preserve mapping, all actions/session gates, customer portals, backend, contracts, provider/permission/CI/package/dependency sources unchanged.
- Consume only the already authenticated current staff document. Positive allowlist label/at; never dump unknown fields, actor guesses, staff tokens, supplier data or internal notes.
- Validate timeline as an array of at most 1000 entries, each plain object with bounded Unicode label (1..500 codepoints) and timezone-qualified valid ISO timestamp (at most64 characters). Unknown fields are not displayed; reject malformed required values without showing a misleading partial timeline.
- Preserve original entry order, duplicate entries, exact recorded label and timestamp; no sorting, locale-time inference or invented actor/history/completeness. Pagination is25 rows, with bounded rendering and clear recorded-order labels.
- Distinguish omitted legacy timeline from present empty timeline and malformed data with honest messages. Absence is not evidence of no prior activity; this is not a complete audit log or proof/payment/production approval.
- Preserve ordinary Unicode and multiline labels with safe React escaping and direction isolation. Visibly encode formatting/bidi and line-separator controls with a legend that stored values are unchanged; do not reinterpret backend labels as commands or links.
- Reset page on document change and remount on record identity; rely on and test existing immutable staff session so Lock/reference edits/Back/BFCache/unmount and delayed responses cannot restore private history.
- Focused Node coverage: absent/empty/malformed, bounds, strict timestamp cases, Unicode/markup/hidden fields, duplicate and original order, page reset, cross-record and Lock isolation. Keep prior diagnostics54 AST rows and5 non-DOM checks unchanged.
- Browser coverage: keyboard/mobile pagination, scoped all-rule axe, no horizontal overflow, malformed reconciliation and dismissal. Inspect actual final desktop/mobile pixels.
- Actual local ASGI qualification: supported synthetic API seeds and authenticated staff read show exact backend timeline; verify read-only state, own fixture identity before writes, provider env stripping/network isolation/redacted errors, and owned helper cleanup. No real data/providers.
- Prefer extending the existing newly added local staff-pieces smoke to observe the same fixture timeline rather than another server harness. Preserve the original four smokes and cross-CI source/wiring; no new CI wiring is admitted.
- Author gate: full Python/Node, optimized build/TypeScript, browser suites, all existing local ASGI qualification, archive/links/contracts/diff and clean frozen source/bundle. Independent review precedes publication.
- No held-source access, accounts/roles/settings changes, price or inventory decisions, production qualification, deploy, AWS or WSL. Two store workers only. Implementation stops2026-11-12T02:20Z; final cutoff03:00Z.

### Explicit stacked history execution authorization
- Root now permits isolated history implementation on independently qualified mapping025af63 while its publication awaits owner approval. This supersedes the checkpoint's implementation wait only; mapping source remains frozen, and history publication/merge still requires predecessor green integration and exact combined independent review.
- The1000-entry/500-label/64-timestamp bounds are existing consumer limits, not backend retention limits; backend event() appends without a declared cap. Over-limit/malformed history is clearly unavailable for reconciliation, never silently truncated or claimed complete.
- Timestamp guard must validate real calendar dates, leap days and numeric timezone offsets without Date.parse normalization, preserving the exact accepted ISO timestamp text rather than converting it to a guessed locale.

### Staff recorded-history implementation and qualification
- Added the read-only RecordedHistory component and only its import/render insertion in StaffWorkspace. Existing actions, lifecycle, mapping, customer portals, backend, contracts, CI, dependencies and permissions are unchanged.
- Validates actual calendar dates and leap years, clock and timezone offset ranges without normalization; renders exact stored timestamps and label order, including duplicates. Uses the admitted consumer limits and 25-row pages, with distinct legacy-absent, empty and malformed messages. No invented actor or audit-completeness claim.
- Safe Unicode rendering, visible control-code legend, private page resets and existing Lock isolation are covered. Over-limit or malformed input shows no partial history; hidden fields are never dumped.
- Author gate passed: 310 Node tests (41 new), 883 Python tests plus 94 subtests, optimized build, TypeScript, 62 browser cases (3 new), archive verification (67 archived / 41 unchanged business files), 31 internal links, OpenAPI contracts and diff checks.
- Extended only the local staff-pieces ASGI smoke to compare displayed timeline labels and timestamps exactly against its authenticated synthetic order. Recorded order is unchanged, history disappears on Lock, and desktop/mobile scoped all-rule axe passes. Existing proof, order-stub, quote, staff and cross-portal ASGI smokes also pass unchanged.
- Final desktop/mobile pixels inspected from artifacts/staff-pieces-real-desktop.png and artifacts/staff-pieces-real-mobile.png. No new clipping or horizontal overflow; recorded timezone text remains visible. Browser pagination screenshot is artifacts/staff-history-mobile-browser.png.
- All owned fixture browser/server processes stopped, ports verified closed, and temporary synthetic databases removed. No provider calls, actual accounts/customer data, deployment or activation. Logs are retained in the existing D: delivery folder under staff-history-* and history-final-*.
- This qualifies the bounded recorded-history display only. Backend history retention is not capped by this component, and missing or over-limit display data must not be mistaken for a complete audit history. Publication still requires independent review and normal predecessor integration.

## RPG-138 / SS-070 synthetic commercial recovery checkpoint
- Root authorized this bounded existing-card slice on independently qualified history dd62185 while history publication awaits approval. Preserve all prior frozen source; no successor publication before dependency integration and exact independent review.
- Scope only the existing synthetic restore-drill test file, RETAIL-TEST documentation and this checkpoint. No runtime, schema migration, provider, real database, actual backup/restore service, workflow or dependency change.
- Add one explicit CommercialDrill profile: the existing 11 base tables plus the five exact fixture_commercial tables and existing publication index. No AUTOINCREMENT or sqlite_sequence is required by this namespace. Preserve all original 111 drill cases, profile selection semantics, 1 MiB cap and schema/path/link/WAL/source-nonmutation safeguards.
- Seed small catalog, price and public-policy test revisions using existing staff fixture APIs and deterministic clocks. Create two exact release sets and publish A, then B, then rollback A; a separate retired-reference variant must remain unresolved after restore without fallback.
- Independently establish exact expected rows, lifecycle/audit steps, references, canonical content hashes, pointer/publication provenance and command receipts. Do not treat the runtime validator or an observed snapshot as the only correctness oracle.
- Verify restored exact request replays without mutation, conflicting request identities and stale CAS rejection, valid next-publication continuity, read-only comparison output and explicit false owner/production approval. Prices are fixed synthetic test amounts only.
- Re-sealed corruption cases cover missing/orphan references, altered lifecycle/audit, pointer/publication disagreement, command receipts, content changed with hashes recomputed and unexpected schema. Reject before target creation and verify original source bytes/state unchanged.
- Keep commercial qualification separate from Square, large contexts, real assets, job/outbox recovery, production schema compatibility, recovery targets and retention. No production DR or business approval claim.
- Author full Python and focused drill suites, archive/links/contracts/diff and clean frozen bundle, followed by independent adversarial/full review. Existing UI/runtime blobs remain identical; no browser or real-provider operation is introduced.
- Feasibility boundary: target implementation freeze by 02:20 UTC; final safe preservation by 03:00 UTC. If independent correctness cannot be established in time, preserve an explicitly incomplete clean checkpoint rather than weaken invariants, claim success or force a merge.

### Commercial recovery fixture implementation and author qualification
- Added only the explicit commercial profile selector and appended CommercialDrill/tests. All 40 original function/class ASTs and decorators remain identical except that selector insertion; the original 111 drill cases and all runtime/UI/CI sources are unchanged.
- Independently constructs expected six snapshot revisions, two manifests, three publication records/current pointer and 17 command receipts before observing API responses. Exact table SQL/indexes and all namespace rows are checked before accepting snapshot state. A deterministic imported commercial clock and Unicode policy text qualify the canonical hash/audit contract.
- Normal and retired-reference roundtrips distinguish historical receipt replay from current publication authority. Stale CAS/conflicting identities fail without mutation; a valid restored publication advances to version four and retains history. A separate WAL test excludes an uncommitted pointer update.
- Eleven re-sealed corruption cases reject before target creation: missing/orphan references, lifecycle/audit/pointer/publication/receipt/fingerprint changes, unknown table, dropped index and altered content with recomputed manifest hash. Original source bytes remain unchanged.
- Author checks passed: 897 Python tests plus 94 subtests, including 14 new commercial cases (125 total drill cases). The initial 124-case drill pass and separate final WAL pass are retained; the final full run includes all 125. Archive 67/41, 31 document links, OpenAPI, diff and AST preservation checks passed.
- No actual database/assets/provider, production backup/restore, new authority or deployment. Source is frozen for independent review; history dependency and exact publication gates remain required. Square, large/private assets, outbox/jobs, production schema and recovery target/retention qualification remain open.


### Commercial recovery review correction: honest completion marker
- Independent interruption review found that the base replay marked its work complete before the commercial profile had finished. The new subclass now clears any prior marker at entry, clears the base marker in a finally block and records completion only after its own final contract checks. The original Drill class remains unchanged.
- Three regressions cover first-command and final-contract interruption after a previously qualified target, and rechecking a used target rejected by the existing sidecar guards. No recovery safety guard is relaxed; failure leaves no success marker.
- Fresh final qualification passed 900 Python tests plus 94 subtests, including all 128 drill cases. The three focused marker tests, original AST preservation, archive 67/41, 31 links, OpenAPI and diff checks passed. Earlier failed regression runs are retained as diagnostic evidence, not counted as qualification.
- This corrects synthetic test-harness status integrity, not a production recovery defect. Prior frozen fea9d4a and its bundle remain preserved and are superseded by this correction; no publication or deployment has occurred.

## RPG-121 / SS-013 customer-order API projection checkpoint (2026-11-12)
- Producer: second store lane; independent reviewer: store integration lead. This is documentation only, based on qualified combined customer/history/recovery tree 5a53854a. No implementation until independent admission and actual customer integration.
- Existing scope: authenticated GET /v1/orders/{id} and customer POST /v1/orders/{id}/cancel-test, both mutation and cancelled/expired replay. No new card or expansion to cart, quote, proof, staff, payment/provider or receipt APIs.
- Verified boundary: private() currently returns the stored JSON after capability verification, and get_order adds availability. The existing UI minimizes retained React/DOM/download data but not network response. Source fields are not proof that real secrets/customer data have been exposed.
- Proposed shared deterministic typed response builder validates original material before positive filtering, never mutates stored JSON, shared private/load/save, staff records, receipts, proof context/hash or provider behavior.
- Required safe fields: id/kind/version/status/payment_status/proof_status, recorded total_minor (including valid null)/currency/next_step, derived test_payment_available, items, timeline label/at and shipment carrier/tracking. Optional fields remain optional; no invented defaults or owner/production approval.
- Preserve explicitly typed existing customer status compatibility fields when present: current_proof_id/current_proof_version/approved_proof_version, reservation_status/test_hold_expires_at, and synthetic test_mode/retail_test/pricing_scope qualification flags. Do not return internal stock identities, provider session identifiers, arbitrary metadata or raw objects. Document exact optional/nullable response schema and fail closed on malformed present fields.
- Item projection contains only product_slug/quantity, optional text/secondary/font and structured personalization. Exclude arbitrary options, notes, gifts, artwork/photo/file metadata and unknown fields only AFTER validating original relevant types/collision rules. Legacy absent versus empty/null/malformed distinctions must not disappear during filtering.
- For structured data validate raw items and canonical snapshots, exact positional line binding, duplicate-SKU separation and original line.item agreement with the raw item before constructing projected line.item. Existing validate_stored_snapshot alone omits the latter check and cannot be the sole guard.
- Compare per-piece assignments by normalized positions, not incidental request array order; preserve exact valid Unicode/whitespace/BOM. Reject missing/orphan/null/mismatched snapshots, bool-coerced indices/counts, competing legacy text and invalid options. Never derive pieces from stock units.
- Project each line to only its validated safe item plus personalization_snapshot where present. Do not rebuild line.item to hide a disagreement. Legacy unallocated orders remain readable without invented piece counts or manufacturing configuration.
- Preserve legitimate legacy multiline text and bounded strings under their original model semantics; structured inscription Cc/Cs rules remain distinct. Customer UI plaintext quoting/control legend stays unchanged.
- Timeline remains recorded order/duplicates and original timestamp strings; no inferred actors or completeness claim. Existing backend is uncapped: any consumer bound must be explicit fail-closed, never silent truncation, and documented against currently accepted records.
- Cancellation must not release stock/save then fail response serialization outside the transaction. Authenticate/enforce current gates, validate original response-relevant material before writes, validate the prospective cancelled response inside the transaction, then commit exact existing mutation/event semantics. Any projection failure leaves records/reservations/events/stock availability unchanged.
- Cancelled/expired replay uses the same projection and consistency checks without new writes. Preserve existing version, payment/provider linkage, reservation and scaffold gates. No changes to payment/proof/production authority.
- Compatibility tests currently using customer GET as an internal raw-record oracle must be split, not weakened: reservation-expiry persistence comparisons and ASGI stock_units assertions move to existing authenticated staff or owned synthetic DB helpers with exact old expected values; separate tests assert customer omission.
- Keep customer approved_proof_version assertions as an explicit compatible status field. The piece-personalization stock-unit check on cart GET stays untouched. External clients are not proven enumerated, so document contract refinement rather than promise universal backward compatibility.
- Planned paths: a focused response module under services/commerce/app, only the two endpoint return sites in workflows.py/retail.py, focused unit/contract tests, OpenAPI export and narrowly necessary existing fixture assertions/docs. No frontend runtime, shared auth, provider adapters, schema migrations, dependencies or CI changes.
- Tests: exact top-level/nested allowlists and hidden sentinel exclusion for GET/cancel mutation/replay; supported legacy/identical/per-piece/same-SKU/reordered/Unicode fixtures; missing/null/malformed/orphan/raw-line disagreement failures before filtering; hidden-only metadata nonmaterial.
- Tests: capability/cross-order denial, all old cancel gates, complete owned logical DB equality on original/prospective projection failure, successful exact-once release and nonmutating replay, unchanged stored order/proof material/receipts/staff output. No real DB or supplied restore input.
- Tests: OpenAPI optional/null parity, full Python/Node/build/typecheck/browser preservation/contracts/links, actual structured customer lookup/download and synthetic cancel behavior against minimized responses, independent adversarial review and old-code sensitivity.
- Customer/API scopes stay partial: no cart/proof/quote minimization, live provider, production data/deploy, ownership approval, tax invoice or manufacturing-readiness claim. Existing source holds and AWS/WSL exclusions remain.
- Publication remains serial after customer predecessor integration, exact new frozen-source independent gate and normal hosted checks. Preserve all original source branches/bundles; no publication from this producer lane.

### Customer order API projection implementation and author qualification
- Added a deterministic closed TypedDict response schema and source-first validator for only customer order GET and cancel-test mutation/replay. Every response/transition is bound to the authenticated path id; unknown metadata is not copied. Optional/nullable semantics are explicit in exported OpenAPI, including nullable current proof id/approved version and absent versus empty items/lines.
- Raw item, line.item and canonical snapshots are validated before omission of options/notes/files/provider/inventory details. Canonical per-piece normalization, positional duplicate-SKU identity, explicit counts, Unicode/BOM and legacy multiline preservation retain existing semantics. Strict bounds and exact recorded timestamps fail closed, without silent truncation or defaulting.
- Original cancellation gates retain their order. Original material is validated before any release/write; prospective validation remains inside database(), so any error rolls back records/reservations/events/stock state. Added both injected failures and real 999/1000-event boundary regressions, plus corrupt stored-id, null/bool/count/mapping/Unicode/metadata cases.
- Authenticated staff/raw storage/receipts/proof material/payment/provider/non-target APIs are unchanged. Author AST proof verifies every non-target workflow/retail definition unchanged, all 128 recovery cases and guards identical except the exact staff read adapter, and every expiry business/race/stock assertion retained except two explicit comparisons to the independently specified public shape. Existing Node/browser assertions are untouched.
- Full internal-state oracles now use existing staff access: expiry and recovery persisted-document reads, both structured ASGI stock-unit checks, and the Square stub's exact fixture session-id assertion. Customer omission is separately asserted. Read-only ASGI flows compare both full stored documents and public responses; synthetic customer cancellation and replay are tested after the read-only section.
- Final author gate passed 993 Python tests plus 94 subtests (68 new API cases), 337 routine Node tests plus 63 prior external customer/history probes, 65 browser cases, optimized build/typecheck, archive 67/41, 32 links, OpenAPI and diff checks. All seven owned loopback ASGI flows passed; the customer flow also cancelled its isolated fixture once and verified exact nonmutating projected replay.
- Initial author tests caught an overly short bound on the existing explanatory pricing_scope string; its explicit 500-character field retains the source qualification wording without pricing activation. A first whole-app smoke run caught an old customer-read assertion for an internal Square session id; the identical id assertion moved to staff and separate network-omission checks were added. Initial failed logs are retained and not counted as qualification.
- Backend lead's preliminary actual-ASGI adversarial probes passed before freeze, including unmocked cancellation boundary rollback; these are preliminary, not final independent acceptance. Final exact-source review/rerun is still required before publication.
- Contract refinement is documented in services/commerce/CUSTOMER-ORDER-RESPONSES.md. This is not universal backward compatibility or API-wide minimization: cart/proof/quote/staff/payment/receipt contracts remain out of scope. No real customer/provider access, credentials, live payment, owner/production approval, deployment, AWS/WSL or held-source changes.


## RPG-124 / SS-044.AC2 fixture lot availability readout checkpoint (2026-11-12)
- Producer: store integration lead after backend lead transferred its clean empty branch; independent reviewer to be assigned before frozen acceptance. Base is verified API mainfa1a1468/tree79a007fe; postmain43268435553 completed/success/all4. This is documentation only until scope admission.
- Existing requirement: distinguish available/reserved/other production-input conditions. Existing lot_state reports physical condition balances; BOM allocation_plan computes free quantities only for a proposed plan. Add one staff/test-only per-lot availability GET so the existing data can be inspected without constructing a BOM request or creating a hold.
- Proposed route under the existing component-ledger router: /lots/{lot_id}/availability. Preserve the same retail_enabled+staff/scaffold gates and test_mode=true/checkout_authoritative=false scope. No customer API, real inventory/fulfillment/checkout/provider/price or manufacturing authority.
- Return only requested lot/component/unit/version and explicit by-location condition quantities, active-reserved units and free units. Condition=available physical units include held units; free=available-condition units minus active reservations, never all-condition totals. Damaged/sample/in_production/completed/shipped balances remain distinct and are not counted as free. Do not add a rejected/inspection state or imply incoming inspection qualification.
- Empty registered lot has an empty location list. A registered location with only other-condition stock may show available/reserved/free zero alongside its real condition balances. No guessed locations, missing components, physical counts or eligibility facts.
- Read all relevant state within one existing database transaction; no stock movements, hold/reservation transitions, command receipts, actor records, lot versions or persistence changes. Preserve every existing endpoint/helper/model/schema definition. New schema/table creation, dependency, auth/security-setting, CI or frontend-runtime changes are excluded.
- Report a bounded complete lot view, not silently truncated pages or synthetic global totals: at most100 relevant locations,1000 scanned fixture hold documents globally and1000 allocation rows for the requested lot across all states, each relevant hold retaining the existing100-allocation bound. Count before filtering; inactive history therefore also consumes these deliberately synthetic read limits. Over-limit source fails409 with no partial result. Optional expected_version may reject stale reads; writes already bump lot versions on movement and hold transitions, and the version is not a permission to reserve later without normal CAS.
- Use the union of balance locations and active-allocation/document references so a hold-only bucket cannot disappear. Validate both allocation-to-hold and hold-document-to-allocation consistency for the requested lot; check original active hold document identity/state, complete allocations and referenced known lot/location/unit definitions before subtraction. Do not repair inconsistencies or clamp negative free units to zero.
- Missing requested lot remains404. Unknown component/location, malformed quantities/conditions or document relationships, partial hold namespace, orphan/missing rows, inactive-document/active-row disagreement, over-reservation or unsupported bound fails a generic409. A wholly absent unused hold namespace can represent no reservations; a partially missing namespace cannot be treated as zero.
- Preserve known per-bucket unit bounds and strict integer semantics. Unknown metadata, raw supplier/lot documents, private order ids and arbitrary audit fields are not returned. Readout makes no complete inventory/audit/inspection or individual-actor claim.
- Planned paths: stock_ledger.py for new strictly typed response/read helper+GET, focused test file, commerce OpenAPI and additive docs/evidence. Reuse component_reservations read helpers only where safe; do not edit reservation/movement mutations or customer_order modules/tests. Shared contracts/docs remain serial behind this already-green main.
- Test through actual opt-in synthetic staff APIs: multiple locations and conditions, partial/multiple holds, release/consume, transfer/count correction, no-reservation namespace, missing/unknown source, stale expected version, bounds and exact quantities. Complete logical DB snapshots before/after successful/error reads must match.
- Adversarial tests cover both missing counterpart directions, malformed/bool/text/out-of-range units, invalid condition/state/unit, phantom locations/holds, over-reserved and hold-only buckets, limit overflow, auth/scaffold/test-gate denial and metadata exclusion. Prove the new read route does not change existing writer CAS, replay, negative-stock or production boundaries.
- Full Python/Node/build/typecheck/browser, all existing actual-ASGI regressions, contracts/preservation/links/diff, source/scope proof and independent exact-source review required before normal draft/checks/merge. Preserve original sources/bundles. No real DB, business stock decision, provider/account, deployment, AWS/WSL or held-source work.
- This is only a bounded fixture availability-read slice. Full SS-044.AC2 includes incoming inspection/defect/eligibility workflows and remains open; broad RPG-124 must not auto-close when this slice merges. Authorization endsNov13 03:00UTC (20:00Arizona).


### Availability readout author qualification / pending independent freeze
- Root and RPG lead independently admitted the bounded design and explicit pre-filter cap refinement before implementation. Feature source appends one typed staff/test GET, leaving every existing stock definition/writer/schema and the reservation Git blob unchanged. New helper SQL is SELECT-only; OpenAPI preserves all old contracts and adds only the route plus three response schemas.
- Author gate passed1085 Python tests+94 subtests (92 new availability cases),337 routine Node tests+63 prior external UI/history probes,65 browser cases, optimized build/typecheck, archive67/41,33 doc links, OpenAPI and diff/scope checks. All seven owned loopback ASGI flows passed; test helpers reported processes stopped, ports closed and synthetic temporary DBs removed.
- Exact-quantity fixtures cover all six conditions, multiple locations and multi-lot holds, release/consume, transfer/count corrections, empty lots and advisory versions. Both orphan directions, other-lot corruption, malformed sources, partial namespaces, over-reservation, exact-cap/cap+1 and full logical DB equality on success/error are covered. No existing regression/assertion was removed or rewritten.
- Initial new tests exposed an incorrect assumption about the existing error wrapper, a positional test mutation aimed at the wrong allocation, and an oversized pytest-generated parameter ID incompatible with Windows. Those new-test issues were corrected without changing existing API error handling or assertions. A wholly absent ledger alongside surviving reservation tables now fails as a partial namespace rather than404. Initial failed logs are preserved separately and are not accepted gate results.
- Source is being frozen for independent exact-source adversarial review before publication. Authenticated read semantics do not establish full DB audit, history completeness, real stock, incoming inspection, production eligibility, checkout authority or production scalability. Full RPG-124/SS-044.AC2 remains open. No deployment, live/provider action, AWS/WSL or held-source access.


## RPG-124 / SS-044.AC2 staff availability display checkpoint (2026-11-12)
- Source investigation and docs-only checkpoint on an isolated stack over frozen API addf288c/tree8602aef4. Root admitted the bounded next slice; independent design admission required before feature edits. API final review/integration remains a dependency: do not publish or merge this successor first.
- Make the fixture-only backend read usable in the existing accessible public-main StaffWorkspace; do not read/reconstruct held guided-design/frontend-rollup/packaging sources. The root approved this separate public-main surface. No customer stock, real inventory or manufacturing approval.
- New FixtureAvailability child renders only after existing staff overview verification, keyed to in-memory session generation and unmounted by existing lock/back/page lifecycle handling. Pass the current in-memory token only to the existing commerce helper, never URLs, storage, exports or analytics. Existing session/mutation functions remain unchanged.
- An explicitly labelled test-lot field and manual read/refresh action use only the new availability GET. No inventory writes, hold creation, record mutations, provider/account changes or activation. Show separate six-condition, reserved and free quantities in accessible mobile-friendly location sections.
- Validate original unknown response before rendering: exact requested lot identity and test_mode=true/checkout_authoritative=false, known unit, nonnegative safe integer version/quantities, complete six-condition keys, unique bounded location identities, reserved<=available and exact free=available-reserved. Build a new positive projection; no raw metadata retained. Reject JS-unsafe source versions rather than round them.
- Label the view as synthetic/test-only, not checkout availability, incoming inspection or permission to reserve. Empty registered lot differs from missing lot; show the observed lot version, not a fabricated last-updated date or current/live-stock claim.
- Clear old result before requests and on input edits/Clear. A request epoch and unmount invalidation reject late responses/errors; one read per current view is admitted, no automatic polling. Backend authority and ordinary CAS remain unchanged. No old result may return after staff lock, session replacement, navigation or newer lookup.
- Use fixed safe status-specific messages for unauthorized/missing/conflict/unavailable/network failures, not arbitrary backend strings. Escape text via React and add no dangerous HTML, file download or persistent browser data. Keep ordinary work usable when this disconnected fixture read is unavailable.
- Proposed exact code scope: new child component, minimal StaffWorkspace import/verified-session insertion, focused Node tests and browser cases. Reuse the existing frontend test command by adding cases to its current staff test file or an explicit locked inclusion without weakened assertions/gates/dependencies. Additive docs only; no API/source changes in this successor.
- Tests cover exact display/projection, malformed/unsafe/bad arithmetic/duplicates/over-limit responses, metadata omission, errors/empty state, repeated submits, pending edit/Clear, old-vs-new lookup, lock and back/page restoration, credential isolation, mobile/desktop accessibility, all old staff regressions and an actual isolated loopback staff API read.
- Full final combined Python/Node/browser/build/typecheck/contracts/preservation/links/diff gates and independent exact-source review are required before normal draft/checks/merge after the API dependency integrates. No deployment, actual stock/business decisions, live provider, real customer data, AWS/WSL or held source. Broad SS-044.AC2 and RPG-124 remain open. Stop safely by Nov13 03:00UTC.


### Staff fixture availability display: recovered final qualification
- Preserved the existing four-path UI candidate after interruption. Added an explicit manual lot lookup within the verified staff workspace, six separate condition balances, reserved/free quantities, strict positive projection and test-only labels. Session generation, Clear/edit/request epochs and existing lifecycle locks prevent stale readout restoration. No inventory writes or new authority.
- Fresh Windows final checks passed 1085 Python tests plus 94 subtests, 400 Node tests twice, 71 browser tests (including six new availability cases), TypeScript, static export and standalone builds, archive 67/41, 33 links, OpenAPI and diff checks. Exact browser UI and API readout were exercised against an isolated real loopback API with synthetic lot/BOM/hold state: physical 15, reserved 2, free 13, exact six conditions, unchanged logical DB, desktop/mobile accessibility and no browser storage changes. Owned helper processes stopped and ports closed.
- Recovery exposed new-test incompatibility with the existing DOM diagnostic guard and an unflushed mount-effect race in the test setup. Only new test assertions/setup were corrected; strict-null semantics and all original diagnostic assertions were retained. Initial failed runs remain diagnostic evidence, not qualified results. The installed npm wrapper failed before scripts with an stdin error; exact direct Node entrypoints and the existing locked Python interpreter were used without installing packages or changing system settings.
- API predecessor PR 33 is merged as 0fd1c46c36f3d9f92a0d1446459056779c11d70b. This UI candidate still requires independent exact-source review and hosted checks before normal publication/merge. Full RPG-124/SS-044.AC2 remains incomplete. No real inventory, customer availability, production release, live provider, deployment, AWS or WSL action.


## RPG-124 / SS-044 incoming inspection checkpoint (2026-11-12)
- Base main 1dfefe834f5feb0223e7afa7df5081602af5e603, after reviewed availability PR34. Existing COM-02 card only; no duplicate card.
- Add opt-in synthetic intake receipts isolated from available balances until a single immutable inspection partitions the exact quantity into accepted and rejected units. Accepted units alone enter available balances; rejected units remain excluded in inspection records. This does not impose a new policy on legacy fixture receipts, and is not production eligibility approval.
- Staff/test gates, bounded strict quantities, global command identity across movements/holds/intake, exact replay, lot optimistic concurrency, atomic persistence and audit, rollback/restart/contention tests. No UI, real stock, supplier/customer data, live providers, AWS/WSL, production policy or deployment.
- Independent design/source review, full relevant verification, draft PR and exact-head hosted checks required before serial integration. End by Nov13 03:00UTC; stop new implementation by02:20UTC. Full SS044/COM02 remains open.


## RPG-124 / SS-044 synthetic inspection readout (November 12)
- Base c93a6c9, reviewed incoming inspection PR35 integrated. Existing card only; backend unchanged.
- Staff-session child uses manual GET for an exact intake reference, never receives or inspects stock. Strict positive projection of fixture identity, quantities/version, pending/inspected partition and known defect state. Pending and rejected are not sellable; accepted is historical inspection, not current free stock or manufacturing permission.
- Clear/edit/Lock/unmount/session changes invalidate older requests and feedback. No persistent browser storage, polling, new credentials or authority. Never render raw backend metadata/errors. Ordinary work remains available if fixture read fails.
- Required gates: focused projection/lifecycle negative tests, actual browser desktop/mobile/Lock cases, full frontend/build/typecheck/Python/contract/preservation checks and independent exact-source review before draft/CI/merge. No live inventory or deployment. Cutoff November13 03:00 UTC.
