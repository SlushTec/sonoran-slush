"""Synthetic fixtures only; none establishes physical suitability."""
from dataclasses import FrozenInstanceError
from hashlib import sha256
import json
import pytest

from services.commerce.app.domain.svg_validation import (
    MAX_BYTES, MAX_DEPTH, MAX_ELEMENTS, MAX_ATTRIBUTE_CHARS, MAX_TEXT_CHARS,
    validate_svg,
)


def svg(body=b'<rect x="1" y="2" width="3" height="4"/>', attrs=b''):
    return (b'<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" '
            b'viewBox="0 0 20 10" ' + attrs + b'>' + body + b'</svg>')


def codes(report):
    return {finding.code for finding in report.findings}


def test_supported_synthetic_shapes_are_held_and_deterministic_without_mutation():
    original = svg(b'<title>Synthetic &amp; safe</title><desc>Test only</desc><g fill="#abc">'
                   b'<rect x="1" y="1" width="2" height="3"/>'
                   b'<circle cx="5" cy="5" r="1"/>'
                   b'<ellipse cx="9" cy="5" rx="2" ry="1"/>'
                   b'<line x1="1" y1="8" x2="19" y2="8" stroke="black"/></g>')
    before = bytes(original)
    report = validate_svg(original)
    assert report.disposition == "held" and report.analysis_complete
    assert len(report.primitives) == 4
    assert report.primitives[0].bounds == ("1", "1", "3", "4")
    assert report.primitives[0].min_positive_extent == "2"
    assert report.original_sha256 == sha256(original).hexdigest()
    assert report.original_bytes == len(original)
    assert report.report_sha256 == sha256(report.canonical_bytes()).hexdigest()
    assert report.report_sha256 != report.original_sha256
    assert report.schema_version == "sonoran.svg-intake/1"
    assert report.validator_version == "1.1.0"
    assert validate_svg(original) == report
    assert validate_svg(original).canonical_bytes() == report.canonical_bytes()
    assert original == before
    assert report.manufacturing_authorized is False
    for field in ("material_suitability", "machine_suitability", "tiny_details", "disconnected_pieces"):
        assert getattr(report, field) == "unknown"
    assert json.loads(report.canonical_bytes())["manufacturing_authorized"] is False
    with pytest.raises(FrozenInstanceError):
        report.disposition = "approved"
    with pytest.raises(FrozenInstanceError):
        report.primitives[0].kind = "path"


@pytest.mark.parametrize("body,code", [
    (b'<script>alert(1)</script>', "ACTIVE_CONTENT_FORBIDDEN"),
    (b'<foreignObject/>', "ACTIVE_CONTENT_FORBIDDEN"),
    (b'<animate attributeName="x"/>', "ACTIVE_CONTENT_FORBIDDEN"),
    (b'<set/>', "ACTIVE_CONTENT_FORBIDDEN"),
    (b'<video/>', "ACTIVE_CONTENT_FORBIDDEN"),
    (b'<rect width="1" height="1" onclick="evil()"/>', "EVENT_HANDLER_FORBIDDEN"),
    (b'<rect width="1" height="1" ONLOAD="evil()"/>', "EVENT_HANDLER_FORBIDDEN"),
    (b'<rect width="1" height="1" href="https://invalid.example/a"/>', "RESOURCE_REFERENCE_FORBIDDEN"),
    (b'<rect width="1" height="1" href="file:///synthetic"/>', "RESOURCE_REFERENCE_FORBIDDEN"),
    (b'<rect width="1" height="1" href="#local"/>', "RESOURCE_REFERENCE_FORBIDDEN"),
    (b'<rect width="1" height="1" fill="url(&#35;paint)"/>', "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<g style="fill:red"/>', "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<g class="paint"/>', "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<g transform="translate(1 1)"/>', "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<style>@import "https://invalid.example/"</style>', "UNSUPPORTED_ELEMENT"),
    (b'<use href="#shape"/>', "UNSUPPORTED_ELEMENT"),
    (b'<defs/>', "UNSUPPORTED_ELEMENT"),
    (b'<path d="M0 0C1 1 2 2 3 3"/>', "UNSUPPORTED_PATH_SYNTAX"),
    (b'<image href="data:image/png;base64,AAAA"/>', "EMBEDDED_RASTER_DECLARED"),
    (b'<image href="https://invalid.example/a.png"/>', "IMAGE_REFERENCE_UNSUPPORTED"),
    (b'<image/>', "IMAGE_REFERENCE_UNSUPPORTED"),
    (b'<text>Text</text>', "UNCONVERTED_TEXT_OR_FONT"),
    (b'<font/>', "UNCONVERTED_TEXT_OR_FONT"),
    (b'<g font-family="Unqualified"/>', "UNCONVERTED_TEXT_OR_FONT"),
    (b'raw text', "UNCONVERTED_TEXT_OR_FONT"),
    (b'<![CDATA[raw text]]>', "CDATA_UNSUPPORTED"),
    (b'<svg/>', "UNSUPPORTED_NESTING"),
    (b'<rect width="2" height="2"><circle r="1"/></rect>', "UNSUPPORTED_NESTING"),
    (b'<rect width="1" height="1" id="x"/>', "UNSUPPORTED_ATTRIBUTE"),
    (b'<rect width="1" height="1" fill="currentColor"/>', "UNSUPPORTED_PAINT"),
    (b'<rect width="1" height="1" stroke-width="-1"/>', "INVALID_STROKE_WIDTH"),
    (b'<rect height="1"/>', "MISSING_GEOMETRY"),
    (b'<rect width="0" height="1"/>', "DEGENERATE_GEOMETRY"),
    (b'<circle r="-1"/>', "DEGENERATE_GEOMETRY"),
    (b'<line/>', "DEGENERATE_GEOMETRY"),
    (b'<rect width="NaN" height="1"/>', "INVALID_NUMBER"),
    (b'<rect width="1e100" height="1"/>', "NUMBER_OUT_OF_RANGE"),
    (b'<rect width="1e-999" height="1"/>', "NUMBER_OUT_OF_RANGE"),
    (b'<rect width="1%" height="1"/>', "INVALID_NUMBER"),
    (b'<rect x="19" width="2" height="1"/>', "GEOMETRY_OUTSIDE_VIEWBOX"),
    (b'<circle r="1"/>', "GEOMETRY_OUTSIDE_VIEWBOX"),
    (b'', "NO_SUPPORTED_GEOMETRY"),
])
def test_unsafe_or_unsupported_synthetic_content_rejected(body, code):
    report = validate_svg(svg(body))
    assert report.disposition == "rejected"
    assert not report.analysis_complete and not report.manufacturing_authorized
    assert code in codes(report)


@pytest.mark.parametrize("source,code", [
    (b'', "MALFORMED_XML"), (b'<svg', "MALFORMED_XML"),
    (svg() + b'<extra/>', "MALFORMED_XML"),
    (b'<svg/>', "INVALID_NAMESPACE"),
    (b'<html xmlns="http://www.w3.org/2000/svg"/>', "INVALID_ROOT"),
    (svg(attrs=b'xmlns:x="urn:untrusted"'), "UNSUPPORTED_NAMESPACE"),
    (b'<?xml-stylesheet href="https://invalid.example/a"?>' + svg(), "PROCESSING_INSTRUCTION_FORBIDDEN"),
    (b'<!DOCTYPE svg SYSTEM "https://invalid.example/a">' + svg(), "DTD_OR_ENTITY_FORBIDDEN"),
    (b'<!DOCTYPE svg [<!ENTITY a "repeated">]>' + svg(b'&a;'), "DTD_OR_ENTITY_FORBIDDEN"),
    (b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///synthetic">]>' + svg(b'&x;'), "DTD_OR_ENTITY_FORBIDDEN"),
    (b'<?xml version="1.0" encoding="iso-8859-1"?>' + svg(), "UNSUPPORTED_XML_DECLARATION"),
    (b'<?xml version="1.1"?>' + svg(), "UNSUPPORTED_XML_DECLARATION"),
    (b'\xff' + svg(), "UTF8_REQUIRED"),
    (svg().decode().encode('utf-16'), "UTF8_REQUIRED"),
    (svg().replace(b'width="20mm"', b'width="20"'), "INVALID_VIEWPORT_UNITS_OR_SIZE"),
    (svg().replace(b'width="20mm"', b'width="100%"'), "INVALID_VIEWPORT_UNITS_OR_SIZE"),
    (svg().replace(b'width="20mm"', b'width="0mm"'), "INVALID_VIEWPORT_UNITS_OR_SIZE"),
    (svg().replace(b'width="20mm"', b''), "EXPLICIT_VIEWPORT_REQUIRED"),
    (svg().replace(b'0 0 20 10', b'0 0 -20 10'), "INVALID_VIEWBOX"),
    (svg().replace(b'0 0 20 10', b'0 0 20'), "INVALID_VIEWBOX"),
    (svg().replace(b'0 0 20 10', b'0,,0,20,10'), "INVALID_VIEWBOX"),
    (svg().replace(b'0 0 20 10', b'0 0 0 10'), "INVALID_VIEWBOX"),
])
def test_xml_and_viewport_failures(source, code):
    report = validate_svg(source)
    assert code in codes(report)
    assert report.disposition == "rejected"
    assert report.original_sha256 == sha256(source).hexdigest()


@pytest.mark.parametrize("source,code", [
    (b' ' * (MAX_BYTES + 1), "INPUT_TOO_LARGE"),
    (svg(b'<g>' * MAX_DEPTH + b'</g>' * MAX_DEPTH), "XML_COMPLEXITY_LIMIT"),
    (svg(b'<g/>' * MAX_ELEMENTS), "XML_COMPLEXITY_LIMIT"),
    (svg(attrs=b' '.join(b'a%d="x"' % n for n in range(17))), "XML_COMPLEXITY_LIMIT"),
    (svg(attrs=b'fill="' + b'a' * MAX_ATTRIBUTE_CHARS + b'"'), "ATTRIBUTE_TOO_LARGE"),
    (svg(b'<title>' + b'a' * (MAX_TEXT_CHARS + 1) + b'</title>'), "TEXT_TOO_LARGE"),
], ids=["bytes", "depth", "elements", "attributes", "attribute-chars", "text-chars"])
def test_resource_limits(source, code):
    report = validate_svg(source)
    assert code in codes(report)
    assert report.disposition == "rejected" and not report.manufacturing_authorized


def test_duplicate_coordinates_and_tiny_extents_do_not_claim_topology_or_manufacturability():
    report = validate_svg(svg(b'<rect width="0.000001" height="1"/>' * 2))
    assert report.duplicate_geometry_pairs == ((2, 3),)
    assert report.primitives[0].min_positive_extent == "0.000001"
    assert report.tiny_details == report.disconnected_pieces == "unknown"
    assert report.disposition == "held" and not report.manufacturing_authorized


def test_paint_and_group_differences_do_not_hide_duplicate_coordinate_geometry():
    report = validate_svg(svg(b'<rect width="1" height="1" fill="black"/>'
                              b'<g><rect height="1.0" width="1.0" fill="white"/></g>'))
    assert report.duplicate_geometry_pairs == ((2, 4),)


def test_partial_observations_never_count_as_complete_after_failure():
    report = validate_svg(svg(b'<rect width="1" height="1"/><script/>'))
    assert len(report.primitives) == 1 and not report.analysis_complete
    assert report.disposition == "rejected"


def test_supported_declaration_bom_and_px_remain_held():
    report = validate_svg(b'\xef\xbb\xbf<?xml version="1.0" encoding="UTF-8"?>' +
                          svg().replace(b'20mm', b'20px'))
    assert report.disposition == "held"
    assert "PHYSICAL_SIZE_UNKNOWN" in codes(report)


@pytest.mark.parametrize("value", ["<svg/>", bytearray(b'<svg/>'), memoryview(b'<svg/>'), None])
def test_input_interface_is_strict(value):
    with pytest.raises(TypeError):
        validate_svg(value)


def test_original_identity_is_preserved_even_when_structure_is_equivalent():
    first, second = svg(), svg().replace(b'/></svg>', b' />\n</svg>')
    a, b = validate_svg(first), validate_svg(second)
    assert a.primitives == b.primitives
    assert a.original_sha256 != b.original_sha256
    assert a.report_sha256 != b.report_sha256


def test_decimal_bounds_do_not_round_away_out_of_viewport_details():
    source = svg(b'<rect x="1000000" width="0.00000000001" height="1"/>').replace(
        b'0 0 20 10', b'0 0 1000000 10')
    assert "GEOMETRY_OUTSIDE_VIEWBOX" in codes(validate_svg(source))


def test_decimal_observations_are_independent_of_callers_precision():
    from decimal import localcontext
    source = svg(b'<rect x="1.23456789" width="0.00000000001" height="1"/>')
    expected = validate_svg(source)
    with localcontext() as context:
        context.prec = 2
        assert validate_svg(source) == expected
    assert expected.primitives[0].bounds[2] == "1.23456789001"


def test_xlink_embedded_raster_is_identified_but_never_decoded():
    source = svg(b'<image xlink:href="data:image/png;base64,not-decoded"/>',
                 b'xmlns:xlink="http://www.w3.org/1999/xlink"')
    assert "EMBEDDED_RASTER_DECLARED" in codes(validate_svg(source))


@pytest.mark.parametrize("value", [b"1e99999999999999999999999", b"1e-99999999999999999999999"])
def test_extreme_numeric_exponents_are_bounded_before_decimal_construction(value):
    assert "NUMBER_OUT_OF_RANGE" in codes(validate_svg(svg(b'<rect width="' + value + b'" height="1"/>')))


def test_unicode_viewbox_whitespace_is_not_silently_normalized():
    source = svg().replace(b'0 0 20 10', '\u00a00 0 20 10\u00a0'.encode())
    assert "INVALID_VIEWBOX" in codes(validate_svg(source))


def test_embedded_svg_is_not_misreported_as_a_verified_raster():
    report = validate_svg(svg(b'<image href="data:image/svg+xml,%3Csvg/%3E"/>'))
    assert "EMBEDDED_IMAGE_UNSUPPORTED" in codes(report)
    assert "EMBEDDED_RASTER_DECLARED" not in codes(report)


def test_numeric_context_limits_cannot_change_validation():
    from decimal import localcontext
    source = svg(b'<rect width="0.00000001" height="1"/>')
    expected = validate_svg(source)
    with localcontext() as context:
        context.prec, context.Emin, context.Emax = 1, -1, 1
        assert validate_svg(source) == expected


def test_non_xml_whitespace_in_geometry_is_not_silently_ignored_as_layout():
    report = validate_svg(svg('\u00a0'.encode()))
    assert "UNCONVERTED_TEXT_OR_FONT" in codes(report)


def test_mutated_decimal_default_context_does_not_change_validation(monkeypatch):
    from decimal import DefaultContext, Inexact, ROUND_DOWN
    source = svg().replace(b'20mm', b'1000mm').replace(b'0 0 20 10', b'0 0 1000 10')
    expected = validate_svg(source)
    for name, value in {"prec": 1, "Emin": -1, "Emax": 1, "rounding": ROUND_DOWN,
                        "clamp": 1, "capitals": 0}.items():
        monkeypatch.setattr(DefaultContext, name, value)
    monkeypatch.setitem(DefaultContext.traps, Inexact, True)
    monkeypatch.setitem(DefaultContext.flags, Inexact, True)
    assert validate_svg(source) == expected
