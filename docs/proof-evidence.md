# Bound local proof evidence

The existing local proof workflow now retains immutable preparation and decision evidence. It does not qualify actual
customer identity, image/export fidelity, physical materials, machine profiles or manufacturing. Existing payment,
reservation, capacity and stage gates remain in force.

Each prepared revision records its exact text and a SHA256 binding to order ID, items, lines (including piece mappings),
merchandise total and currency. Payment/status/capacity/hold changes do not invalidate spelling approval. Material changes
do: staff must prepare a new revision and the private-link holder must review it. Prior wording and decision facts remain
unchanged. Context snapshots are canonical UTF8 JSON and deduplicated by hash, including the order ID; conflicting bytes
cannot overwrite an existing hash. All evidence/current-proof/order writes share one transaction.

New approvals and fresh release require bound current evidence and a matching live material hash. An already executed
in-production release retry returns its existing receipt without another stock consumption. Legacy quote release remains
blocked. An old proof without evidence remains readable but cannot acquire a new approval or fresh release until revised.
At revision, only the one actual retained legacy document is captured as unbound observation at the current time. Earlier
missing versions, actors, decision times and configurations remain unknown. Reads do not initialize proof evidence or
silently migrate/approve anything.

History uses the existing proof private capability:
- `GET /v1/proofs/{id}/history?after=0&limit=25`: bounded revision metadata and any unbound legacy observation metadata.
- `GET /v1/proofs/{id}/history/{version}`: one exact validated bound revision, its material context and recorded decisions.

The technical limits are1000 newly prepared versions,1000 decision events per version and32MiB per context. These are not
customer revision entitlements. Metadata pages never contain context blobs. The context cap accommodates current accepted
maximum cart fields,2000 supplementary-Unicode piece names and legacy JSON control escaping; a tested legal case exceeds
19MiB. Canonical encoding uses ensure_ascii=False. Legacy unpaired surrogates require controlled reconciliation rather than
silent text replacement or a UTF8 crash. This is still partial SS-032 acceptance, not production approval.

Compatibility limit: legacy bulk quotes can contain no configured items. Such retained orders remain readable, but a new
bound proof cannot invent their missing configuration. They require a separately reviewed configured-order migration.
The32MiB sizing guarantee covers admitted configured orders, not empty/unknown legacy business details or malformed state.
