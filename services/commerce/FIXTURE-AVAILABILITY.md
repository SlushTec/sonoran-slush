# Fixture lot availability readout

This is a staff-only, opt-in synthetic component-ledger read, not checkout stock
authority or an incoming-inspection/production qualification.

## Read contract

GET /v1/admin/retail-test/component-ledger/lots/{lot_id}/availability

The existing scaffold/request, retail-test and staff gates apply unchanged.
An optional expected_version query rejects a stale lot version with a generic409.
A successful read is an observation in one existing SQLite transaction, not a
reservation permission: later changes still require normal writer CAS.

The closed response contains only lot_id, component_id, unit, version, locations,
test_mode=true and checkout_authoritative=false. Each location contains:

- condition_units: available, damaged, sample, in_production, completed, shipped;
- reserved_units: units in consistent active fixture holds for this lot/location;
- free_units: available-condition units minus active reserved units.

Available-condition physical stock includes held units. Other-condition stock is
not free. No global totals combine incompatible component units. Locations sort
by their existing identity. A registered empty lot returns locations=[]; a location
with only another condition retains its real condition amounts and zero available,
reserved and free. This does not invent counts for other registered locations.

No raw supplier/lot documents, private order identifiers, hold documents or arbitrary
audit metadata are returned. Existing writer, staff detail and reservation APIs are
unchanged. Reading does not create fixture tables or repair inconsistent sources.
The common database context retains its existing connection/core bootstrap behavior;
logical DB nonmutation qualification is against initialized isolated fixtures.

## Fail-closed source reconciliation

Before subtraction, the read checks both allocation-row to hold-document and
hold-document to complete allocation-row relationships. All members of a relevant
multi-lot hold are checked against known component/unit, lot and location definitions,
but only the requested lot contributes to its report. Inactive allocations must
agree with their released/consumed document state and never count as reserved.

Hold-only locations are not discarded. Missing counterpart rows/documents, unknown
definitions, malformed source types, duplicate JSON members or allocation buckets,
invalid states/conditions, over-reservation and negative free amounts return a
generic409 without partial output or state repair. An absent unused reservation
namespace can mean no holds; a partially missing namespace cannot mean zero.
A wholly absent ledger or a missing requested lot returns404; an incomplete ledger
namespace returns409. These checks are scoped to this report, not a complete DB audit.

## Deliberate synthetic read limits

This endpoint is bounded and complete, not paginated or silently truncated:

- at most100 relevant locations;
- at most600 condition-balance rows (100 locations times six conditions);
- at most1000 scanned fixture hold documents globally;
- at most1000 requested-lot allocation rows across all states;
- at most100 allocations in every relevant hold;
- at most262144 characters in an interpreted fixture document.

Queries use cap+1 detection and reject excess before filtering/interpreting it.
Unrelated historical holds can therefore make this read unavailable at the global
cap. Inactive requested-lot history also consumes its scan limit. Unsupported or
ambiguous data fails409, not a guessed zero or a truncated success. These are
fixture read limits, not production-scale indexing, throughput, request-memory or
general denial-of-service guarantees. No pagination cleanup or historical deletion
is implied or performed.

## Remaining requirement

This is a bounded partial SS-044.AC2 / RPG-124 slice. Incoming inspection, rejected
stock, defects, measured machine eligibility, actual stock decisions, customer
availability, production integration and manufacturing approval remain open.
No real inventory, business price, payment, provider, account, deployment, AWS/WSL
or held frontend-source activation is included.
