# RPG-124 / SS-048 synthetic count preview

Checkpoint base: f9e532ff91bbeb436180c69baf224117a01acf77. A repository search found no existing count-reconciliation preview. Existing movements support count correction; this slice does not modify that writer.

Scope: staff/test-only POST read preview with an exact expected lot version and 1-100 unique explicit location/condition observations. Strict bounded integers only. Compare named buckets against the existing validated availability view in one transaction. Omitted buckets are not zero or counted; new but registered empty locations may be compared to zero. Return recorded and observed units, signed variance, and a reservation-floor conflict for available-condition observations below active reserved units. A conflict is shown honestly, not clamped or applied.

No schema change, mutation, receipt, count history, actor claim, stock correction, reservation or audit write. Pending/rejected intake remains outside condition balances. No aggregation across unlike units, no inference of present physical stock from shipped/completed history. All observations are synthetic and the preview does not authorize a later correction: existing writer CAS and protected-reservation checks remain authoritative.

Required gates: explicit/partial/empty/new-location comparisons, negative/positive/zero variance, reservation floor, malformed inputs, stale version, corrupt source, missing lot/location, all auth/stage gates and logical-state nonmutation, OpenAPI/inventory updates, full Python and independent review. No provider, actual customer/business data, live inventory, production policy, AWS/WSL or deployment. Full COM02/SS048 remains open. Stop by November13 03:00UTC.
