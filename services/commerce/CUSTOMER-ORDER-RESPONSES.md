# Customer order response boundary

This is an opt-in, scaffold-only contract refinement under RPG-121 / SS-013.
It does not enable customer accounts, production commerce or a provider.
It covers only:

- Authenticated `GET /v1/orders/{record_id}`.
- Customer `POST /v1/orders/{record_id}/cancel-test`, including cancelled/expired replay.

Cart, quote, proof, staff, receipt and payment APIs are not changed. In particular,
this is not a claim that every customer API is minimized or that external clients
have been enumerated. Existing clients relying on raw order internals must migrate.

## Public response

The OpenAPI `CustomerOrder` schema is closed at every object level.
The implementation validates relevant original material before filtering and
returns an explicitly constructed dictionary. Unknown fields are not copied.

Required fields: id, kind=order, version, order/payment/proof statuses,
total_minor (a valid integer or null) and currency.

Optional compatibility fields, retained only when recorded:
next_step, derived test_payment_available, current_proof_id,
current_proof_version, approved_proof_version, reservation_status,
test_hold_expires_at, test_mode, retail_test and pricing_scope.

`current_proof_id` and `approved_proof_version` may legitimately be null.
Other optional fields are omitted when absent, not filled with defaults.
Malformed present fields do not become absence, false, zero or an empty collection.
GET derives sandbox availability exactly as before; cancellation does not invent it.

Nested fields:

- Items: product_slug, quantity and recorded text/secondary/font/personalization.
- Lines: validated safe item and canonical personalization_snapshot, when recorded.
- Timeline: exact recorded label and timestamp only, preserving order and duplicates.
- Shipment: recorded carrier and tracking only.

No raw stock identities/units/offer versions, provider/session identifiers,
inventory/capacity bookkeeping, arbitrary options, notes, gifts, artwork/photo/file
metadata or unknown fields are included. Removing them from responses does not
remove or alter them in storage or authenticated staff records.

## Consistency before filtering

Structured assignments reuse the existing authoritative inscription models.
Original item and line.item identity, quantity, font, text, options and normalized
assignments must agree before either is projected. Raw per-piece request ordering
is not material; canonical snapshot ordering and positional line/set/piece identity are.
Duplicate product slugs do not merge lines.

Missing/null/orphan/extra-key/mismatched snapshots, boolean numeric positions/counts,
competing legacy text and invalid original options fail closed. A canonical line is
never rebuilt from another item to conceal disagreement. Piece counts are explicit,
not inferred from stock consumption. The stored id must match the authenticated path
before a response or cancellation transition can proceed.

Legacy absent/empty items and unallocated text remain distinct. Valid multiline,
whitespace, accents, supplementary Unicode and BOM are retained. Structured text
keeps its existing nonblank/control/surrogate rules; legacy text is not silently
converted into structured text. Customer UI quoting remains unchanged.

Bounds match the current private consumer: 100 items/lines, quantity 1..500,
1..100 explicit pieces per item, at most 500 assigned pieces per line and 2,000
overall, and at most 1,000 timeline entries. Strings have explicit field bounds;
amounts/versions must be safe integers. Recorded ISO timestamps require a valid
calendar, timezone and up to six fractional digits; the original string is retained.

Over-limit or malformed material returns a generic 409 reconciliation response,
not a partial/truncated success. A legitimate record exceeding these consumer
bounds needs a separately designed paginated API before customer use.

## Cancellation atomicity

Authentication and existing version/payment/provider/reservation/scaffold gates
remain in their original order. The source is validated before a release/write.
The prospective result is validated inside the existing database transaction.
A failure rolls back records, reservations, events and stock state together;
response-model validation outside the transaction is not used as the rollback guard.

Cancelled/expired replay uses the same projection with no new event or write.
For example, a valid 999-event source can append its cancellation event once;
a 1,000-event source cannot append an unrepresentable 1,001st event and remains
unchanged. No payment, proof or production authority is added.

## Test oracle separation

Existing expiry and recovery tests read complete persisted state through the
already-authenticated staff endpoint rather than treating customer GET as a
database dump. Their underlying state/hash/replay/stock assertions are retained.
Separate independent expected public shapes assert exact customer output.

Owned ASGI/browser smokes retain exact stock-unit checks through staff reads,
assert their omission from the customer network response and compare entire
stored orders before/after read-only interaction. The customer smoke additionally
tests projected cancellation and nonmutating replay on its isolated synthetic order.
No supplied database, real customer/provider data or persistent credentials are used.
