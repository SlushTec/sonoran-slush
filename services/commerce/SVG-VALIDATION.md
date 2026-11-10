# Disconnected SVG intake — SS-058 partial slice

This is a structural intake validator, not a renderer, repair tool, manufacturing
profile, production gate or completed SS-058 implementation. All fixtures are
synthetic. No design library, customer content or other-lane artifact was used.

Base: public PR #3 commit `19c2b2c53189d896ccbee1a37cd843f4fad42e01`.
Branch: `team/svg-intake-validation`; worktree `/workspace/sonoran-svg-isolated`.
The separate QR candidate `0993871d6a1920b9a7e236d9865a11eaacf25aba` is unchanged.
Only this document, `app/domain/svg_validation.py` and
`../../tests/unit/test_svg_validation.py` are new. No existing source, dependency,
contract, catalog, pricing or release gate changed. AGENT-02/04 retain integration
review responsibility; nothing is wired or published.

## Interface and identity

`validate_svg(original: bytes) -> Report` accepts exact immutable bytes only.
It does not read paths, fetch URLs, decode images, upload, render, rewrite SVG,
substitute fonts or access services. Caller retains the original bytes; no copy is
persisted by this module. `original_sha256` hashes the full input, including BOM,
whitespace and invalid/oversized bytes. Never replace that identity with a parsed
or normalized document. Enforce the same byte limit at any future transport
boundary: hashing oversized input is linear in its actual length, although no
oversized input is parsed.

The frozen report includes schema `sonoran.svg-intake/1`, validator `1.0.0`, input
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
- One `svg` root; groups, title/description and basic `rect`, `circle`, `ellipse`,
  `line` geometry. No nested SVG, paths, polygons, use/defs, clipping, filters,
  transforms, CSS/class/style, scripts, events, animation, foreignObject or
  unsupported attributes. Unsupported structures are rejected rather than
  approximately evaluated. This excludes many otherwise valid SVG files.
- Explicit positive root width/height with `mm`, `cm`, `in`, `pt` or `px`, plus a
  positive-width/height numeric viewBox. Percentages, implicit units and relative
  units are rejected. Pixel dimensions additionally report physical-size unknown.
  Declared dimensions are observations, not conversions or fabrication dimensions.
- Geometry uses explicit unitless user coordinates with SVG zero defaults for
  positions. Positive dimensions/radii, nondegenerate lines and primitive
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

## Bounds and observations, not physical qualification

Limits: 131072 bytes, 1024 elements, depth 32, 16 attributes per element, 4096
characters per attribute name/value pair, 4096 total character-data characters,
and 1024 namespace declarations. Comments are inert and bounded by total bytes.
Expat callbacks enforce limits without constructing an XML tree and reject DTDs
before entity processing. External entity handling aborts; parameter entities
are disabled. Resource budgets are fixed implementation limits, not business data.

Numbers have at most 64 characters, absolute value at most 1000000, encoded
exponent magnitude at most 128, and nonzero adjusted exponent at least -64.
Bounds use a private 160-digit Decimal context. Decimal strings in the report are
exact numeric observations, not rewritten original SVG. Numeric limits prevent
unbounded computation; they are **not approved manufacturing minimum sizes**.

Duplicate pairs identify same-tag, numerically identical basic coordinate
geometry only, independent of paint/group membership. Reversed lines, equivalent
shapes expressed differently, near-duplicates or unsupported geometry are not
classified. `min_positive_extent` is only the smallest positive axis-aligned
coordinate extent; it is not stroke width, minimum feature size, connectivity,
cut viability or a physical measurement. No minimum-size/material/machine profile
is bundled, and no physical tests have been performed.

## Verification and review

Use the unchanged lockfile environment from the allowed QR checkout:
`/workspace/sonoran-qr-isolated/.venv/bin/python` (Python 3.12).
Focused command: `-m pytest -q tests/unit/test_svg_validation.py`.
Full suite: `-m pytest -q`; archive check: `scripts/verify_archive.py`.
Focused checks: 90 passed. Full suite: 149 passed with one existing
Starlette/httpx deprecation warning. Archive verification: 67 archived files and
41 unchanged business files verified. Exact commit/patch identities accompany
the delivery response.
Frontend, browser/rendering, uploads, production and physical machine tests are
not run or claimed by this disconnected Python slice.

Independent reviewer `svg_review` inspected source/tests read-only. Its first
pass found Unicode viewBox whitespace normalization and inaccurate embedded-image
classification. Both were fixed and regression-tested. Decimal precision and
adversarial exponent handling were also hardened. The re-review found inherited mutable Decimal defaults; all numeric context
settings are now explicit, with a regression for mutated defaults. Final
independent review found no unresolved blocking findings in this documented
subset: 90 focused tests passed and the default-context crash no longer
reproduced. Reviewer also checked six external-reference/entity fixtures with
file/network access patched to fail, plus 2000 seeded byte mutations; no resource
access or nondeterministic/crashing reports were found. These checks are
additional evidence, not exhaustive parser or physical qualification.
