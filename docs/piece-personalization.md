# Explicit piece personalization (test only)

The existing synthetic retail cart can carry an optional `personalization` object per item:

- Identical: `{"mode":"identical","text":"Example"}`.
- Per piece: `{"mode":"per_piece","pieces":[{"set_index":0,"piece_index":0,"text":"Example"}]}`.

Indices are zero-based within the purchased quantity and the independently configured pieces per item. Repeated wording
is permitted, but duplicate positions, missing pieces and extra pieces are rejected. Text is preserved exactly, including
valid accents/emoji and surrounding whitespace, but blank content, controls and unpaired surrogates are rejected.

Staff must explicitly set `pieces_per_item` (integer1..100) on the existing test offer before structured personalization
is accepted. It is NOT inferred from `units_per_item`, which remains stock consumption only. Omitted piece count retains
an existing configured count on staff offer updates; entirely legacy offers keep their original document shape. Explicit
null is rejected rather than silently clearing configuration. Changing the count increments the normal offer version.

Structured personalization rejects competing legacy `text`/`secondary` and arbitrary option keys. Existing crystal shape,
size and orientation keys remain valid. Notes and artwork metadata are not parsed as piece assignment commands. Common
font remains independent. A maximum500 pieces per structured line and2000 per cart bounds normalization; legacy carts
without the new field retain their existing limits, serialization defaults, request digests and replay behavior.

Each structured line receives an immutable `personalization_snapshot` with schema_version1, mode, original line_index,
quantity, pieces_per_item and sorted exact piece assignments. Raw submitted configuration remains in items, so changing
or reordering it under the same request UUID conflicts rather than silently changing history. Cart-to-order repricing
checks the offer version and exact mapping before reserving anything. Changed offers require a new reviewed cart.

Proof revisions do not rewrite ordered piece assignments. This does not interpret proof prose or qualify per-piece
manufacturing proof approval. Physical product/set compatibility, real prices, customer data, checkout activation and
full SS-031 acceptance remain outside this opt-in local fixture slice.
