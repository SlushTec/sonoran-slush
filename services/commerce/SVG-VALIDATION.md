# Disconnected SVG intake: SS-058 partial slice

This is a structural intake validator, not a renderer, repair tool, manufacturing
profile, production gate or completed SS-058/AI-04 implementation. All fixtures are
synthetic. No design library, customer content or held-lane artifact was used.

The 1.1.0 path-observation slice extends the admitted public main
`4c8e40f175a7a273e682db09cc278cde03b3276a`. It changes only the SVG validator,
its tests and this document, following the separately reviewed delivery checkpoint
and Windows test-ID repair. The QR helper, dependencies, contracts, catalog,
pricing and release gates are unchanged. No endpoint is wired and no physical
qualification or production profile is added.

## Interface and identity

`validate_svg(original: bytes) -> Report` accepts exact immutable bytes only.
It does not read paths, fetch URLs, decode images, upload, render, rewrite SVG,
substitute fonts or access services. Caller retains the original bytes; no copy is
persisted by this module. `original_sha256` hashes the full input, including BOM,
whitespace and invalid/oversized bytes. Never replace that identity with a parsed
or normalized document. Enforce the same byte limit at any future transport
boundary: hashing oversized input is linear in its actual length, although no
oversized input is parsed.

The frozen report includes schema `sonoran.svg-intake/1`, validator `1.1.0`, input
length, findings in deterministic document order, and partial observations.
`canonical_bytes()` is sorted compact ASCII JSON; `report_sha256` hashes those
bytes separately, excluding its own hash. Reports contain no raw source text,
URI, customer data or timestamps. `analysis_complete=false` means observations
cover only the prefix inspected before rejection; never treat them as exhaustive.

Disposition is always `rejected` or `held`. Every returned report has
`manufacturing_authorized=false`; material/machine suitability, tiny details and
disconnected pieces remain `unknown`. No caller-supplied approval/profile switch
exists. A held structural report cannot authorize a machine, material, order or
release. Owner review and physical qualification remain necessary.

## Deliberately narrow supported subset

- UTF-8 XML 1.0; the SVG namespace is mandatory. SVG/xlink namespace declarations
  are inspectable, but references are never followed. No DTD, declared entities,
  processing instructions or CDATA. Predefined XML escapes/numeric character
  references are handled by Expat, followed by the same validation checks.
- One `svg` root; groups, title/description, basic `rect`, `circle`, `ellipse`,
  `line` geometry and the restricted `path` grammar below. No nested SVG,
  polygons, use/defs, clipping, filters, transforms, CSS/class/style, scripts,
  events, animation, foreignObject or unsupported attributes. Unsupported
  structures are rejected rather than approximately evaluated.
- Explicit positive root width/height with `mm`, `cm`, `in`, `pt` or `px`, plus a
  positive-width/height numeric viewBox. Percentages, implicit units and relative
  units are rejected. Pixel dimensions additionally report physical-size unknown.
  Declared dimensions are observations, not conversions or fabrication dimensions.
- Basic geometry uses explicit unitless user coordinates with SVG zero defaults
  for primitive positions. Positive dimensions/radii, nondegenerate lines and
  coordinate bounds within viewBox are required. Paint is restricted to none,
  black, white, or three/six-digit hex; nonnegative numeric stroke width is allowed.
  Stroke envelope, visual appearance, hidden/overlapping shapes, fill connectivity
  and effects of scaling are not qualified. Even a very thick stroke remains held
  with an explicit unknown stroke-envelope finding.
- Text/font elements or attributes are explicitly rejected as unconverted.
  Image elements are rejected: known raster data-URI MIME declarations are labeled
  `EMBEDDED_RASTER_DECLARED`, not verified image bytes. Other data images and
  external/absent references have distinct unsupported findings. No embedded
  payload is decoded and no resource is fetched. Validation stops at first hard
  rejection, so later content may not have been classified.

## Restricted absolute straight-line paths

The only supported command sequence is one explicit uppercase `M x y`, one or
more explicit uppercase `L x y`, and an optional single terminal uppercase `Z`.
There is exactly one subpath. Each L must change position, and Z must close a
nonzero-length edge. Open paths, horizontal/vertical segments and retracing are
coordinate observations only, not evidence of connectivity or cut viability.

For example, `M1 2L3 4L5 2Z` and `M 1,2 L3,4 L5,2 Z` are supported.
ASCII XML whitespace (space, tab, CR, LF) is optional around commands and at the
ends. The two coordinates in each pair must be separated by one or more ASCII
XML whitespace characters, or one comma with optional such whitespace around it.
A comma cannot appear before/after a command or at the end. Command letters may
directly follow the preceding coordinate. Number spellings allow an optional sign,
ASCII digits and a decimal point, including `.5` and `1.`; exponent notation is
deliberately unsupported in path data. Root/basic-primitive number rules are unchanged.

The parser rejects relative commands, H/V, curves/arcs, implicit repeated coordinate
pairs, multiple subpaths, repeated/nonterminal Z, adjacent numbers without a
separator (`1-2`, `1.2.3`), Unicode whitespace/digits, exponents, nonfinite values,
malformed separators and unknown characters. This deliberately rejects many valid
general SVG paths. No fallback parser, approximation, renderer or dependency is used.

Per path, the fixed limits are 512 non-whitespace tokens (each command, number or
comma counts as one) and 128 explicit L segments, plus at most one closing Z.
The existing attribute, numeric, byte and element limits also apply. A path
exceeding any limit is rejected without emitting a partial observation for that
path. Earlier supported elements may remain in an incomplete, rejected report.
Token scanning is bounded by the attribute size and stops after the first excess
token; no recursive parsing or XML tree construction is used.

Bounds are the exact minima/maxima of all explicit vertices in user coordinates.
For this straight-line subset the closing segment cannot extend those bounds.
Duplicate observations require the same ordered numeric vertex sequence and the
same explicit closure state. Only numeric spelling, signed zero, command spacing
and coordinate separators are normalized for this in-memory comparison.
Paint and group membership do not participate.

No collinear simplification, traversal reversal, start-point rotation, near-match,
cross-kind or topology equivalence is claimed. An explicit closing L and terminal
Z remain different observations even when their drawn centerlines coincide.
Neither the input bytes nor a rewritten/normalized artwork artifact is exported.

## Bounds and observations, not physical qualification

Global limits remain: 131072 bytes, 1024 elements, depth 32, 16 attributes per element,
4096 characters per attribute name/value pair, 4096 total character-data characters,
and 1024 namespace declarations. Comments are inert and bounded by total bytes.
Expat callbacks enforce limits without constructing an XML tree and reject DTDs
before entity processing. External entity handling aborts; parameter entities
are disabled. Resource budgets are fixed implementation limits, not business data.

Numbers have at most 64 characters, absolute value at most 1000000, encoded exponent
magnitude at most 128 (where exponents are supported), and nonzero adjusted exponent
at least -64. Bounds use a private 160-digit Decimal context, independent of caller
precision/defaults. Decimal strings in the report are exact numeric observations,
not rewritten original SVG. Numeric limits prevent unbounded computation; they are
**not approved manufacturing minimum sizes**.

Basic-shape duplicates still identify same-tag, numerically identical coordinate
geometry only. Reversed lines or equivalent shapes expressed differently are not
classified. `min_positive_extent` is only the smallest positive axis-aligned
coordinate extent; it is not stroke width, minimum feature size, connectivity,
cut viability or a physical measurement. No minimum-size/material/machine profile
is bundled, and no physical tests have been performed.

## Verification and review

Use the existing Python environment from the unchanged requirements lockfile:

```text
python -m pytest -q tests/unit/test_svg_validation.py tests/unit/test_svg_paths.py tests/unit/test_qr_fulfillment.py
python -m pytest -q
python scripts/verify_archive.py
python scripts/check_links.py
python -m scripts.export_contracts --check
git diff --check
```

On Windows, use Python UTF-8 mode (`PYTHONUTF8=1`). The six pre-existing oversized
SVG resource-limit cases now have compact explicit pytest IDs; their exact
payloads, assertions and count are unchanged. This avoids an oversized
`PYTEST_CURRENT_TEST` environment variable and does not skip or weaken a test.

Tests cover grammar/separators, unsupported commands/exponents, numeric/bounds
edges, degenerate segments, exact-sequence-only duplicate semantics, token/segment/
attribute/element budgets, source/report identity, non-mutation, Decimal contexts,
I/O guards, XML attacks and 1000 seeded byte mutations with repeated-run checks.
Exact source identities, test outcomes and independent review accompany the
candidate receipt; no unperformed review is asserted here.

The original 1.0.0 structural foundation had 90 focused tests and independent
adversarial review, including Unicode, embedded-image and Decimal-context fixes.
That historical evidence does not substitute for reviewing the new path parser.
Frontend, browser/rendering, uploads, production and physical machine tests are
not run or claimed by this disconnected Python slice. Whole SS-058 and AI-04
remain open.
