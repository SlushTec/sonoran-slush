"""Synthetic straight-line paths only; no rendering or physical qualification."""
from dataclasses import FrozenInstanceError
from hashlib import sha256
import random

import pytest

from services.commerce.app.domain.svg_validation import (
    MAX_ATTRIBUTE_CHARS, MAX_ELEMENTS, MAX_PATH_SEGMENTS, MAX_PATH_TOKENS,
    validate_svg,
)


def svg(body, view_box=b"0 0 20 10"):
    return (b'<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" '
            b'viewBox="' + view_box + b'">' + body + b'</svg>')


def path(data, attrs=b""):
    return b'<path d="' + data + b'" ' + attrs + b'/>'


def codes(report):
    return {finding.code for finding in report.findings}


def assert_closed(report):
    assert report.disposition in {"held", "rejected"}
    assert report.manufacturing_authorized is False
    assert report.material_suitability == report.machine_suitability == "unknown"
    assert report.tiny_details == report.disconnected_pieces == "unknown"


@pytest.mark.parametrize("data", [
    b"M1 2L3 4", b"M 1 2 L 3 4", b" M1 2 L3 4 ",
    b"M1,2L3,4", b"M 1 , 2 L 3 , 4",
    b"M+1.000 2.L3.000 +4.",
    b"M01 02L03 04", b"M1 2L3 4Z", b"M1 2L3 4 Z ",
    b"M1&#9;2L3&#10;4", b"M1&#13;2L3 4",
])
def test_supported_path_forms_are_coordinate_observations_only(data):
    source = svg(path(data))
    before = bytes(source)
    report = validate_svg(source)
    assert report.disposition == "held" and report.analysis_complete
    assert len(report.primitives) == 1
    assert report.primitives[0].kind == "path"
    assert report.primitives[0].bounds == ("1", "2", "3", "4")
    assert report.primitives[0].min_positive_extent == "2"
    assert_closed(report)
    assert source == before
    assert report.original_sha256 == sha256(source).hexdigest()
    assert report.report_sha256 == sha256(report.canonical_bytes()).hexdigest()
    assert report.original_sha256 != report.report_sha256
    for _ in range(3):
        assert validate_svg(source) == report
        assert validate_svg(source).canonical_bytes() == report.canonical_bytes()


@pytest.mark.parametrize("data", [
    b"", b" ", b"Z", b"L1 1", b"M", b"M1", b"M1 1L", b"M1 1L2",
    b"M1 1 2 2", b"M1 1L2 2 3 3", b"M1 1M2 2L3 3",
    b"M1 1L2 2ZL3 3", b"M1 1L2 2ZZ", b"M1 1L2 2Z0",
    b"M,1 1L2 2", b"M1,,1L2 2", b"M1 1,L2 2", b"M1 1L,2 2",
    b"M1 1L2 2,", b"M1 1L2 2 Z,", b"M1-1L2 2", b"M1+1L2 2",
    b"M1.1.2L2 2", b"M1 1L2.2.3", b"M1 1L2+2",
    b"M1;1L2 2", b"M1/1L2 2", b"M1 1L2 2!",
], ids=lambda data: data.decode("ascii"))
def test_malformed_or_implicit_path_data_rejects(data):
    report = validate_svg(svg(path(data)))
    assert report.disposition == "rejected" and not report.analysis_complete
    assert not report.primitives
    assert_closed(report)


@pytest.mark.parametrize("data", [
    b"m1 1l2 2", b"M1 1l2 2", b"M1 1L2 2z",
    b"M1 1H2", b"M1 1V2", b"M1 1C2 2 3 3 4 4",
    b"M1 1S2 2 3 3", b"M1 1Q2 2 3 3", b"M1 1T2 2",
    b"M1 1A1 1 0 0 0 2 2", b"M1e0 1L2 2", b"M1 1L2E0 2",
    b"M1e9999999999999999999999999999999 1L2 2",
    b"M1e-999999999999999999999999999999 1L2 2",
    b"MNaN 1L2 2", b"MInfinity 1L2 2", b"M0x1 1L2 2",
    b"M1&#160;1L2 2", b"M&#1633; 1L2 2", b"M1&#11;1L2 2",
], ids=[f"unsupported-{i}" for i in range(20)])
def test_unsupported_commands_exponents_and_unicode_reject(data):
    report = validate_svg(svg(path(data)))
    assert report.disposition == "rejected" and not report.analysis_complete
    assert not report.primitives
    assert_closed(report)


@pytest.mark.parametrize("data,code", [
    (b"M1 1", "DEGENERATE_GEOMETRY"),
    (b"M1 1Z", "DEGENERATE_GEOMETRY"),
    (b"M1 1L1.00 +1", "DEGENERATE_GEOMETRY"),
    (b"M1 1L2 2L2 2", "DEGENERATE_GEOMETRY"),
    (b"M1 1L2 2L1 1Z", "DEGENERATE_GEOMETRY"),
    (b"M-1 1L2 2", "GEOMETRY_OUTSIDE_VIEWBOX"),
    (b"M1 1L21 2", "GEOMETRY_OUTSIDE_VIEWBOX"),
    (b"M1 1L2 11", "GEOMETRY_OUTSIDE_VIEWBOX"),
    (b"M1 1L1000001 2", "NUMBER_OUT_OF_RANGE"),
    (b"M1 1L" + b"9" * 65 + b" 2", "INVALID_NUMBER"),
    (b"M1 1L0." + b"0" * 64 + b"1 2", "INVALID_NUMBER"),
], ids=[f"numeric-{i}" for i in range(11)])
def test_path_numeric_and_degenerate_cases_fail_closed(data, code):
    report = validate_svg(svg(path(data)))
    assert report.disposition == "rejected"
    assert code in codes(report)
    assert not report.primitives
    assert_closed(report)


@pytest.mark.parametrize("body,code", [
    (b"<path/>", "MISSING_GEOMETRY"),
    (path(b"M1 1L2 2", b'transform="scale(2)"'), "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<g transform="scale(2)">' + path(b"M1 1L2 2") + b"</g>", "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (path(b"M1 1L2 2", b'style="stroke:red"'), "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (path(b"M1 1L2 2", b'pathLength="1"'), "UNSUPPORTED_ATTRIBUTE"),
    (path(b"M1 1L2 2", b'onload="untrusted"'), "EVENT_HANDLER_FORBIDDEN"),
    (path(b"M1 1L2 2", b'href="file:///synthetic"'), "RESOURCE_REFERENCE_FORBIDDEN"),
    (path(b"M1 1L2 2", b'fill="url(https://invalid.example/)"'), "CSS_OR_TRANSFORM_UNSUPPORTED"),
    (b'<path d="M1 1L2 2"><line x2="1"/></path>', "UNSUPPORTED_NESTING"),
    (b'<path d="M1 1L2 2">unconverted</path>', "UNCONVERTED_TEXT_OR_FONT"),
], ids=[f"structure-{i}" for i in range(10)])
def test_paths_do_not_bypass_existing_structural_security(body, code):
    report = validate_svg(svg(body))
    assert report.disposition == "rejected" and code in codes(report)
    assert_closed(report)


def test_exact_ordered_coordinate_sequence_duplicates_ignore_paint_and_groups():
    report = validate_svg(svg(
        path(b"M-0 +0L1.00 2L3 4Z", b'fill="black"') +
        b"<g>" + path(b"M0,0 L+1,2.000 L03,+4 Z", b'fill="white"') + b"</g>" +
        path(b"M0 0L1 2L3 4Z")))
    assert report.disposition == "held"
    assert report.duplicate_geometry_pairs == ((2, 4), (2, 5))
    assert report.primitives[0].bounds == ("0", "0", "3", "4")
    assert_closed(report)


def test_same_bounds_or_equivalent_drawn_geometry_is_not_claimed_duplicate():
    report = validate_svg(svg(
        path(b"M1 1L3 3") + path(b"M3 3L1 1") +
        path(b"M1 1L2 2L3 3") + path(b"M1 3L3 1") +
        path(b"M1 1L3 3Z") + path(b"M1 1L3 3L1 1") +
        b'<line x1="1" y1="1" x2="3" y2="3"/>'))
    assert report.disposition == "held" and len(report.primitives) == 7
    assert report.duplicate_geometry_pairs == ()
    assert_closed(report)


def test_exact_bounds_include_interior_vertices_and_negative_coordinates():
    report = validate_svg(svg(path(b"M-3 -2L2 4L-1 -4L3 1Z"), b"-5 -5 10 10"))
    assert report.disposition == "held"
    assert report.primitives[0].bounds == ("-3", "-4", "3", "4")
    assert report.primitives[0].min_positive_extent == "6"


def test_coordinate_numeric_boundary_and_tiny_extent_are_not_physical_limits():
    edge = validate_svg(svg(path(b"M0 0L1000000 1000000"), b"0 0 1000000 1000000"))
    assert edge.disposition == "held"
    tiny = b"0." + b"0" * 61 + b"1"
    report = validate_svg(svg(path(b"M0 0L" + tiny + b" 1")))
    assert report.disposition == "held"
    assert report.primitives[0].bounds == ("0", "0", tiny.decode(), "1")
    assert report.primitives[0].min_positive_extent == tiny.decode()
    assert_closed(report)


def test_tiny_outside_viewbox_does_not_round_into_bounds():
    report = validate_svg(svg(path(b"M1 1L20.00000000000000000001 2")))
    assert report.disposition == "rejected"
    assert "GEOMETRY_OUTSIDE_VIEWBOX" in codes(report)


def test_path_identity_report_immutability_and_original_bytes_are_separate():
    first = svg(path(b"M1 1L2 2"))
    second = svg(path(b"M01,1.0 L2,2"))
    a, b = validate_svg(first), validate_svg(second)
    assert a.primitives == b.primitives
    assert a.original_sha256 != b.original_sha256
    assert a.report_sha256 != b.report_sha256
    with pytest.raises(FrozenInstanceError):
        a.primitives[0].bounds = ("0", "0", "0", "0")
    with pytest.raises(FrozenInstanceError):
        a.manufacturing_authorized = True


def test_path_observations_are_independent_of_decimal_context(monkeypatch):
    from decimal import DefaultContext, Inexact, ROUND_DOWN, localcontext
    source = svg(path(b"M0 0L1.234567890000000000000000001 2"))
    expected = validate_svg(source)
    for name, value in {"prec": 1, "Emin": -1, "Emax": 1, "rounding": ROUND_DOWN,
                        "clamp": 1, "capitals": 0}.items():
        monkeypatch.setattr(DefaultContext, name, value)
    monkeypatch.setitem(DefaultContext.traps, Inexact, True)
    with localcontext() as context:
        context.prec, context.Emin, context.Emax = 1, -1, 1
        context.traps[Inexact] = True
        assert validate_svg(source) == expected


def test_path_segment_budget_exact_boundary_and_one_over():
    def data(count):
        return b"M0 0" + b"".join(b"L1 1" if i % 2 == 0 else b"L0 0" for i in range(count))
    at_limit = validate_svg(svg(path(data(MAX_PATH_SEGMENTS))))
    assert at_limit.disposition == "held"
    over_limit = validate_svg(svg(path(data(MAX_PATH_SEGMENTS + 1))))
    assert "PATH_COMPLEXITY_LIMIT" in codes(over_limit)
    assert not over_limit.primitives and not over_limit.analysis_complete


def test_path_token_budget_counts_commands_numbers_and_commas():
    # M and 127 L commands, each followed by two numbers and one comma.
    assert MAX_PATH_TOKENS == 512
    data = b"M0,0" + b"".join(b"L1,1" if i % 2 == 0 else b"L0,0" for i in range(127))
    assert validate_svg(svg(path(data))).disposition == "held"
    over_limit = validate_svg(svg(path(data + b"Z")))
    assert "PATH_COMPLEXITY_LIMIT" in codes(over_limit)
    assert over_limit.disposition == "rejected" and not over_limit.primitives


def test_path_attribute_budget_applies_before_tokenization():
    report = validate_svg(svg(path(b"M0 0L1 1" + b" " * MAX_ATTRIBUTE_CHARS)))
    assert "ATTRIBUTE_TOO_LARGE" in codes(report) and not report.primitives


def test_many_paths_obey_existing_global_element_budget():
    shape = path(b"M0 0L1 1")
    report = validate_svg(svg(shape * (MAX_ELEMENTS - 1)))
    assert report.disposition == "held"
    assert len(report.primitives) == MAX_ELEMENTS - 1
    assert len(report.duplicate_geometry_pairs) == MAX_ELEMENTS - 2
    rejected = validate_svg(svg(shape * MAX_ELEMENTS))
    assert "XML_COMPLEXITY_LIMIT" in codes(rejected)
    assert not rejected.analysis_complete
    assert len(rejected.primitives) == MAX_ELEMENTS - 1


def test_later_rejection_keeps_only_partial_observations_without_approval():
    report = validate_svg(svg(path(b"M1 1L2 2") + path(b"M1 1C2 2 3 3 4 4")))
    assert len(report.primitives) == 1
    assert report.disposition == "rejected" and not report.analysis_complete
    assert_closed(report)


def test_no_file_network_access_or_source_echo_for_path_and_xml_attacks(monkeypatch):
    import builtins
    from pathlib import Path
    import socket
    import urllib.request

    def forbidden(*args, **kwargs):
        raise AssertionError("Validator attempted I/O")

    sources = [
        svg(b"<title>synthetic-private-marker</title>" + path(b"M1 1L2 2")),
        svg(path(b"M1 1L2 2", b'href="https://invalid.example/synthetic-private-marker"')),
        b'<!DOCTYPE svg SYSTEM "https://invalid.example/synthetic-private-marker">' + svg(path(b"M1 1L2 2")),
        b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///synthetic-private-marker">]>' + svg(path(b"M1 1L2 2")),
        b'<!DOCTYPE svg [<!ENTITY a "x"><!ENTITY b "&a;&a;">]>' + svg(path(b"M1 1L2 2")),
    ]
    with monkeypatch.context() as patch:
        patch.setattr(builtins, "open", forbidden)
        patch.setattr(Path, "open", forbidden)
        patch.setattr(socket, "socket", forbidden)
        patch.setattr(socket, "create_connection", forbidden)
        patch.setattr(urllib.request, "urlopen", forbidden)
        for index, source in enumerate(sources):
            report = validate_svg(source)
            assert report.disposition == ("held" if index == 0 else "rejected")
            assert b"synthetic-private-marker" not in report.canonical_bytes()
            assert b"invalid.example" not in report.canonical_bytes()
            assert_closed(report)


def test_seeded_mutations_never_crash_or_change_repeated_results():
    rng = random.Random(580132)
    seed = svg(path(b"M1 1L2 3L4 2Z"))
    alphabet = b"MLZmlzCQAHV0123456789+-.eE ,;\t\n<>&'\x00\xff"
    for _ in range(1000):
        data = bytearray(seed)
        for _ in range(rng.randrange(1, 5)):
            position = rng.randrange(len(data))
            data[position] = rng.choice(alphabet)
        source = bytes(data)
        report = validate_svg(source)
        assert validate_svg(source) == report
        assert report.original_sha256 == sha256(source).hexdigest()
        assert_closed(report)
