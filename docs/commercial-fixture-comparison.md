# Commercial fixture comparison

This staff-only local test tool compares immutable fixture revisions and release sets. It is not a price quote,
owner approval, customer catalog, order migration, or production readiness check. SS-006.AC3 remains partial.

Both POST endpoints are read-only operations; POST carries strict structured reference pairs rather than commands.
No request UUID is accepted, no replay receipt is stored, and no pointer, audit, publication or domain row is changed.
Existing request, scaffold-stage, retail-test and staff gates apply. Stored access configuration must still match.

- `/v1/admin/retail-test/commercial/compare/snapshots`: `before` and `after` each contain `snapshot_id` and integer
  `revision`. Compare the same kind only. Draft or retired lifecycle is visible but grants no readiness.
- `/v1/admin/retail-test/commercial/compare/sets`: `before` and `after` are exact release-set IDs. All references must
  retain their recorded hashes, compatible eligible/priced product sets, and approved_test lifecycle. Retirement fails closed.

Changes are sorted by product/variant or policy key, independent of source row order. Each change includes the exact
before/after row and added/removed/changed classification. Existing price-pair deltas are integer USD minor units;
added/removed prices have a null delta because no comparable prior/new price exists. Lifecycle and exact source identities
are reported separately from row changes. Identical comparisons return empty changes, never a commercial approval.

Every result has `comparison_only: true`, `test_mode: true`, `owner_approved: false`, and `production_approved: false`.
Options, tax, machine profiles, owner identity and production remain explicitly unqualified.

The reader opens an existing SQLite file with mode=ro and query_only, then uses a single deferred read transaction.
It never calls database initialization, schema creation, journal-mode changes, chmod, mkdir, or fingerprint repair.
Missing database returns404; missing registry tables, invalid stored documents/references or SQLite corruption return409.
Absent or mismatching persisted access configuration returns503. No missing database or parent directory is created.
SQLite may use or create transient -wal/-shm reader-coordination sidecars beside an existing WAL database. This is not a promise of zero filesystem activity; no business/schema/database-content mutation occurs. It is not an immutable-file bypass of concurrent updates.
A comparison is consistent at its transaction snapshot, not a guarantee that a subsequent action sees the same state.
