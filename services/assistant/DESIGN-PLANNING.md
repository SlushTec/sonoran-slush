# Photo design planning boundary v1

Owner: assistant lane (AGENT-03). Integration reviewer requested: commerce lane
(AGENT-02); serial integration review: AGENT-04. This is a proposed isolated
interface, not a change to commerce contracts, proof authorization or the backlog.

This module plans metadata. It does not read, restore, crop, composite, optimize or
export image bytes. It has no model, network, credential, payment, supplier or
machine adapter. The existing assistant endpoint remains disabled. No real
merchant qualification profiles are included; synthetic profiles live only in the
focused test fixtures and are ignored unless the caller explicitly opts into the
synthetic planning test mode.

## Calling contract

`design_planning.schema.json` is a standalone Draft 2020-12 contract. Root objects
are original records or version records; `$defs` also describes render evidence,
review evidence and exact qualification profiles. Every object forbids unknown
fields, every declared property is required, and null is allowed only where
explicit. `validate_record(record, kind=None)` checks root records; use the named
`original`, `version`, `render`, `review` or `profile` definition when appropriate.
The runtime validator implements only the subset used by this file. It is not a
replacement for a general JSON Schema validator.

`parse_json(payload)` rejects duplicate JSON keys and non-finite numbers.
Integrating adapters should use it before accepting JSON; an ordinary decoder may
have already discarded duplicate keys. Numbers must be finite, booleans are not
numbers, and integer fields require Python integers (stricter than JSON Schema's
mathematical interpretation of `1.0`). Inputs are JSON-shaped dicts and lists.
Use positive physical dimensions in millimetres and positive output dimensions
in pixels. Aspect ratio must equal width / height. Crop and placement rectangles
are normalized to the source and output canvas respectively. Scale and rotation
are explicit; no processor or automatic fit algorithm exists here.

```python
from services.assistant.design_planning import PlanningSnapshot, plan

snapshot = PlanningSnapshot(
    records=authorized_immutable_records,
    renders=verified_render_metadata,
    reviews=verified_review_metadata,
    profiles=qualified_profile_metadata,
)
result = plan(candidate, snapshot, owner_id=authenticated_owner, intent="preview")
```

The variable names above describe duties of a future adapter, not verification
performed by this module. Do not pass browser-supplied reviews, profiles or owner
claims directly into this interface. `PlanningSnapshot` copies metadata to bytes
and immutable mappings so subsequent caller mutation cannot rewrite the snapshot.
It does **not** authenticate a caller, check revocations, inspect images, verify
signatures or establish storage durability. It contains no enabled defaults.

Result fields:

| Field | Meaning |
| --- | --- |
| `plan_digest` | Domain-separated fingerprint of the complete candidate metadata |
| `status` | `blocked`, `staff_review`, `planned_preview`, or `reviewed_preview` |
| `reasons` | Sorted fixed reason codes; no photo content or customer identifiers |
| `rendered_metadata_present` | Matching render record supplied; not proof bytes were inspected |
| `production_authorized` | Always false; not constructor-settable |
| `machine_ready` | Always false; not constructor-settable |

`InvalidPlan` rejects malformed, cross-owner, replaced or invalid-lineage records.
Missing review evidence returns a blocked result; unknown/unsafe machine profiles
and unresolved restoration ambiguity require staff review. If both apply, status
is blocked and all reasons remain available. No result contains an executable
machine file, signed download URL or authorization to export. `intent` may be
`preview`, `collage`, `proof` or `export`; the last three additionally require the
candidate's exact output review **as a planning check only**. A preview can remain
unrendered. Only a matching rendered record plus exact customer review can yield
`reviewed_preview`, which still never authorizes production.

## Original identity, versioning and review

An original binds an opaque owner-scoped original identity, source SHA-256, pixel
dimensions and known opaque subject identities. There is no mutator. An original
identity may occur only once per snapshot, and replacing bytes under an old hash
causes missing-lineage rejection. The storage layer still must enforce immutable
original objects and verify the source SHA-256 from trusted stored bytes. The
planner cannot determine whether a subject was actually present in a photo.

A version binds an immutable version identity, exact source fingerprints, recipe,
output metadata (or null), detail flags, collage layout and product target. A new
recipe, rendered output, dimension, source, layout, target or profile creates a
new version identity. In particular, attaching a render to an unrendered plan
creates a new immutable record; do not overwrite its old identity. Old review
receipts cannot match the new digest. All referenced records must be present,
owned by the same owner and at an allowed lineage stage. Depth is capped at 64.

The versioned recipe contains explicit crop, background removal/preservation,
brightness/contrast, cleanup and export format/dimensions/aspect ratio. Recipe
changes are bound even if a caller claims an unchanged output hash. The v1
fingerprint is SHA-256 of `sonoran-design-planning:v1` plus a NUL and canonical
JSON: sorted keys, ASCII escapes, compact separators, finite numbers and integral
floats normalized to integers. This is a specified Python v1 representation,
**not RFC 8785**; other-language adapters must reproduce it exactly or use a
server-returned digest. Source/output SHA-256 values describe bytes; a plan
fingerprint describes metadata. They are not interchangeable.

Render evidence must match the exact version digest and output SHA-256,
dimensions and aspect ratio. Customer review must match the same digest and
output hash with the stage-specific purpose. A staff ambiguity review is a
separate purpose and cannot replace customer review. Receipts without matching
render evidence fail the planning gate. Metadata supplied by a caller remains
only a claim: hashes and review receipts do not prove that rendered bytes existed,
were inspected, or were approved by the authenticated person. Commerce remains
the sole owner of authentic proof approval and production authorization.

## Restoration, collage and product derivatives

Restoration starts from an original or an exact earlier restored version. Cleanup
that requests synthesis must disclose `synthesized`; `uncertain` and `synthesized`
flags must propagate to descendants. Each flagged rendered version needs a staff
ambiguity review. These flags and receipts never establish recovered facial truth
or verified likeness. Any inference or invented detail must remain disclosed to
the customer. Actual restoration and likeness qualification remain future work.

A collage uses exact original/restored source versions. Prior restored sources
must have matching render evidence and exact restored-version customer approval
before downstream collage, proof or derivative planning can pass. Layout binds
an explicit version and one placement per unique known subject: source digest,
subject identity, normalized position and size, scale and rotation. Every source
must be used, all placements must reference a real source/subject link, and
unknown/duplicate subjects are rejected. New synthetic cleanup is unavailable in
collage/derivative recipes; it requires a separate disclosed restoration version.
No automatic extra people, missing limbs, facial features or background scenes
are invented. Source or placement changes invalidate prior collage reviews.

A derivative takes one original, restored master or collage and binds the exact
product, blank/revision, material, finish, coating, physical dimensions,
geometry/revision/curvature, method, machine/technology and profile/version.
Preview/export dimensions and aspect ratio are separately bound by the recipe
and output. A reusable restored master does not confer approval on a new product
preview. Every rendered derivative needs its own exact-output customer review.
No universal material preset or fallback qualification exists.

An exact profile additionally requires opaque SHA-256 references to qualification,
physical-test and staff-review evidence. These are metadata requirements, not
verification of the underlying test or its author. Profiles must come from a
future staff-controlled registry of real, current qualifications. Unknown matches
remain unavailable and route to staff. Synthetic test evidence is not merchant
qualification, even when test mode exercises a successful planning path.

Hard planning constraints:

- Crystal subsurface requires `jet-mini` with `green` technology. Surface,
  `subsurface_2d`, and supplier-assisted `subsurface_3d` are distinct methods.
- Curved Jet Mini work is ineligible. Exact blank, geometry revision, physical
  dimensions and curvature must match the qualification record. Display names
  such as heart, sphere or rectangle are never used to guess eligibility.
- Glass surface requires `xtool-f2-uv` with `uv` technology. This machine cannot
  satisfy subsurface work, and Jet Mini cannot satisfy surface work.
- Fiber is unavailable. CO2, diode and IR surface combinations still need exact
  qualification and physical-test evidence for their dimensions and finish/coating.
- Every `subsurface_3d` plan retains a supplier-assisted staff-review requirement.
  One ordinary photograph cannot establish 360-degree/all-angle geometry or truth.
  There is no all-angle inference, point-cloud generation or supplier submission.

## Privacy and integration work still required

Keep raw images, names, filenames, storage URLs and customer contact information
out of this interface. IDs and hashes are still sensitive linkable metadata:
authorize access, avoid general analytics and do not log full plans or snapshots.
This module has no logging or persistence. Trusted storage admission, malware/
format validation, retention/deletion, encryption, access controls, revocation,
consent/rights, byte hashing and audit evidence belong to future integration work.

Commerce must resolve the authenticated owner and trusted records, verify actual
rendered bytes, enforce exact-current-version reviews and independent payment,
stock and production state machines. UI must distinguish a planned preview from
a viewed rendered proof. A real renderer/model, physical material tests, machine
qualification, likeness review and human approval workflow are absent. These
files do not complete feature cards or establish production readiness.

## Verification

Run without installing packages:

```sh
python -m unittest discover -s tests/unit -p test_design_planning.py -v
python3 scripts/verify_archive.py
python -m scripts.export_contracts --check
```

The test file uses only standard-library unittest and synthetic metadata. It is
also discoverable by the existing pytest suite when pytest is available. Test
coverage includes immutable copied originals, strict schemas/numbers, missing and
replaced/cross-owner lineage, duplicate/unknown subjects, restoration ambiguity,
render/review mismatches, stale source/recipe/output/layout/target approvals,
physical evidence requirements and machine/method/geometry rejection.
