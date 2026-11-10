"""Disconnected conservative SVG intake. No rendering, rewriting or release authority."""
from dataclasses import asdict, dataclass
from decimal import Context, Decimal, DivisionByZero, InvalidOperation, Overflow, ROUND_HALF_EVEN, localcontext
from hashlib import sha256
import json
import re
from xml.parsers import expat

SCHEMA_VERSION = "sonoran.svg-intake/1"
VALIDATOR_VERSION = "1.1.0"
MAX_BYTES = 131072
MAX_ELEMENTS = 1024
MAX_DEPTH = 32
MAX_ATTRIBUTES = 16
MAX_ATTRIBUTE_CHARS = 4096
MAX_TEXT_CHARS = 4096
MAX_PATH_TOKENS = 512  # Commands, numbers and commas; whitespace is not a token.
MAX_PATH_SEGMENTS = 128  # Explicit L segments; one optional closing Z is separate.
PATH_TOKEN = re.compile(r"[MLZ]|[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)|,")
SVG_NS = "http://www.w3.org/2000/svg"
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
SEPARATOR = r"(?:\s*,\s*|\s+)"
GEOMETRY = {
    "rect": ("x", "y", "width", "height"),
    "circle": ("cx", "cy", "r"),
    "ellipse": ("cx", "cy", "rx", "ry"),
    "line": ("x1", "y1", "x2", "y2"),
}
PAINT = {"fill", "stroke", "stroke-width"}


@dataclass(frozen=True)
class Finding:
    code: str
    element: int = 0  # Document-order index; zero denotes the document.


@dataclass(frozen=True)
class Primitive:
    element: int
    kind: str
    # Coordinate geometry only: excludes stroke, clipping, and physical effects.
    bounds: tuple[str, str, str, str]
    min_positive_extent: str | None


@dataclass(frozen=True)
class Report:
    schema_version: str
    validator_version: str
    original_sha256: str
    original_bytes: int
    disposition: str
    findings: tuple[Finding, ...]
    primitives: tuple[Primitive, ...]
    duplicate_geometry_pairs: tuple[tuple[int, int], ...]
    view_box: tuple[str, str, str, str] | None
    declared_viewport: tuple[str, str] | None
    analysis_complete: bool
    material_suitability: str = "unknown"
    machine_suitability: str = "unknown"
    tiny_details: str = "unknown"
    disconnected_pieces: str = "unknown"
    manufacturing_authorized: bool = False

    def canonical_bytes(self) -> bytes:
        """Separate immutable derived report; its digest is not the input digest."""
        return json.dumps(asdict(self), sort_keys=True, separators=(",", ":"),
                          ensure_ascii=True, allow_nan=False).encode("ascii")

    @property
    def report_sha256(self) -> str:
        return sha256(self.canonical_bytes()).hexdigest()


class _Stop(Exception):
    def __init__(self, code):
        self.code = code


def _number(value):
    if len(value) > 64 or re.fullmatch(NUMBER, value, flags=re.ASCII) is None:
        raise _Stop("INVALID_NUMBER")
    exponent = re.search(r"[eE]([+-]?\d+)$", value)
    if exponent and abs(int(exponent[1])) > 128:
        raise _Stop("NUMBER_OUT_OF_RANGE")
    number = Decimal(value)
    if abs(number) > 1_000_000 or (number and number.adjusted() < -64):
        raise _Stop("NUMBER_OUT_OF_RANGE")
    return number if number else Decimal(0)


def _decimal_text(value):
    # Canonical observation only, never a rewritten SVG coordinate.
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _numbers(value, count):
    if re.fullmatch(NUMBER + (SEPARATOR + NUMBER) * (count - 1), value.strip(" \t\r\n"), re.ASCII) is None:
        raise _Stop("INVALID_VIEWBOX")
    return tuple(_number(v) for v in re.split(SEPARATOR, value.strip(" \t\r\n")))


def _path(value):
    """Observe one bounded explicit M/L[/Z] sequence, not general SVG geometry."""
    tokens = []
    offset = 0
    while offset < len(value):
        if value[offset] in " \t\r\n":
            offset += 1
            continue
        match = PATH_TOKEN.match(value, offset)
        if match is None:
            raise _Stop("UNSUPPORTED_PATH_SYNTAX")
        tokens.append((match[0], offset, match.end()))
        if len(tokens) > MAX_PATH_TOKENS:
            raise _Stop("PATH_COMPLEXITY_LIMIT")
        offset = match.end()

    cursor = 0

    def number():
        nonlocal cursor
        if cursor >= len(tokens) or tokens[cursor][0] in {"M", "L", "Z", ","}:
            raise _Stop("INVALID_PATH_DATA")
        result = _number(tokens[cursor][0])
        cursor += 1
        return result

    def point():
        nonlocal cursor
        x = number()
        end = tokens[cursor - 1][2]
        if cursor < len(tokens) and tokens[cursor][0] == ",":
            cursor += 1
        elif cursor >= len(tokens) or tokens[cursor][1] == end:
            # Adjacent signed/decimal numbers (e.g. 1-2 or 1.2.3) are excluded.
            raise _Stop("INVALID_PATH_DATA")
        return x, number()

    if not tokens or tokens[0][0] != "M":
        raise _Stop("INVALID_PATH_DATA")
    cursor = 1
    vertices = [point()]
    closed = False
    while cursor < len(tokens):
        command = tokens[cursor][0]
        cursor += 1
        if command == "Z":
            if cursor != len(tokens):
                raise _Stop("INVALID_PATH_DATA")
            closed = True
        elif command == "L":
            if len(vertices) - 1 >= MAX_PATH_SEGMENTS:
                raise _Stop("PATH_COMPLEXITY_LIMIT")
            vertex = point()
            if vertex == vertices[-1]:
                raise _Stop("DEGENERATE_GEOMETRY")
            vertices.append(vertex)
        else:
            raise _Stop("INVALID_PATH_DATA")
    if len(vertices) < 2:
        raise _Stop("DEGENERATE_GEOMETRY")
    if closed and vertices[-1] == vertices[0]:
        raise _Stop("DEGENERATE_GEOMETRY")
    xs, ys = zip(*vertices)
    # Ordered vertices + explicit closure only. Do not simplify, reverse, rotate,
    # infer topology, or equate an explicit closing L with terminal Z.
    return (tuple(vertices), closed), (min(xs), min(ys), max(xs), max(ys))


def validate_svg(original: bytes) -> Report:
    """Inspect exact immutable UTF-8 bytes. Never fetch, upload, render or normalize.

    Strict basic-shape and explicit straight-line-path subset only. A nonrejected
    report remains held for owner review and physical qualification. Unknown inputs are not
    accepted as self-asserted approvals. No filesystem or network API is used.
    """
    if type(original) is not bytes:
        raise TypeError("SVG input must be immutable bytes")
    findings, primitives, duplicates = [], [], []
    view_box = viewport = None
    complete = False
    index = 0
    digest = sha256(original).hexdigest()

    def finish():
        return Report(SCHEMA_VERSION, VALIDATOR_VERSION, digest, len(original),
                      "held" if complete else "rejected", tuple(findings),
                      tuple(primitives), tuple(duplicates),
                      tuple(_decimal_text(n) for n in view_box) if view_box else None,
                      viewport, complete)

    if len(original) > MAX_BYTES:
        findings.append(Finding("INPUT_TOO_LARGE"))
        return finish()
    try:
        original.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError:
        findings.append(Finding("UTF8_REQUIRED"))
        return finish()
    # XML NUL is forbidden, including UTF-16/32 byte signatures.
    if b"\x00" in original:
        findings.append(Finding("UTF8_REQUIRED"))
        return finish()
    parser = expat.ParserCreate(namespace_separator="}")
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    stack, signatures = [], {}
    text_chars = 0
    namespaces = 0

    def stop(code):
        raise _Stop(code)

    def namespace(prefix, uri):
        nonlocal namespaces
        namespaces += 1
        if namespaces > MAX_ELEMENTS:
            stop("XML_COMPLEXITY_LIMIT")
        if uri not in {SVG_NS, "http://www.w3.org/1999/xlink"}:
            stop("UNSUPPORTED_NAMESPACE")

    def declaration(version, encoding, standalone):
        if version != "1.0" or (encoding and encoding.lower() != "utf-8"):
            stop("UNSUPPORTED_XML_DECLARATION")

    def start(name, attrs):
        nonlocal index, view_box, viewport
        index += 1
        if index > MAX_ELEMENTS or len(stack) >= MAX_DEPTH or len(attrs) > MAX_ATTRIBUTES:
            stop("XML_COMPLEXITY_LIMIT")
        if any(len(k) + len(v) > MAX_ATTRIBUTE_CHARS for k, v in attrs.items()):
            stop("ATTRIBUTE_TOO_LARGE")
        if not name.startswith(SVG_NS + "}"):
            stop("INVALID_NAMESPACE")
        tag = name[len(SVG_NS) + 1:]
        if not stack and tag != "svg":
            stop("INVALID_ROOT")
        if tag in {"text", "tspan", "textPath", "font", "glyph", "font-face"}:
            stop("UNCONVERTED_TEXT_OR_FONT")
        if tag == "image":
            href = attrs.get("href", attrs.get("http://www.w3.org/1999/xlink}href", ""))
            resource = href.lstrip(" \t\r\n").lower()
            mime = resource[5:].split(";", 1)[0].split(",", 1)[0]
            if resource.startswith("data:"):
                raster = mime in {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/tiff", "image/avif"}
                stop("EMBEDDED_RASTER_DECLARED" if raster else "EMBEDDED_IMAGE_UNSUPPORTED")
            stop("IMAGE_REFERENCE_UNSUPPORTED")
        if tag in {"script", "foreignObject", "animate", "animateMotion", "animateTransform", "set", "audio", "video"}:
            stop("ACTIVE_CONTENT_FORBIDDEN")
        if tag not in {"svg", "g", "title", "desc", "path", *GEOMETRY}:
            stop("UNSUPPORTED_ELEMENT")
        if stack and (tag == "svg" or stack[-1] in {"title", "desc", "path", *GEOMETRY}):
            stop("UNSUPPORTED_NESTING")
        for key, value in attrs.items():
            local = key.rsplit("}", 1)[-1]
            if local.lower().startswith("on"):
                stop("EVENT_HANDLER_FORBIDDEN")
            if local in {"href", "src"}:
                stop("RESOURCE_REFERENCE_FORBIDDEN")
            if local.startswith("font"):
                stop("UNCONVERTED_TEXT_OR_FONT")
            if local in {"style", "class", "transform"} or "url(" in value.lower():
                stop("CSS_OR_TRANSFORM_UNSUPPORTED")
        allowed = {"width", "height", "viewBox"} if tag == "svg" else set(GEOMETRY.get(tag, ()))
        if tag == "path":
            allowed.add("d")
        if tag not in {"title", "desc"}:
            allowed |= PAINT
        if set(attrs) - allowed:
            stop("UNSUPPORTED_ATTRIBUTE")
        for paint in ("fill", "stroke"):
            if paint in attrs and re.fullmatch(r"(?:none|black|white|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})", attrs[paint]) is None:
                stop("UNSUPPORTED_PAINT")
        if "stroke-width" in attrs and _number(attrs["stroke-width"]) < 0:
            stop("INVALID_STROKE_WIDTH")
        if tag == "svg":
            if set(("width", "height", "viewBox")) - attrs.keys():
                stop("EXPLICIT_VIEWPORT_REQUIRED")
            for dimension in (attrs["width"], attrs["height"]):
                match = re.fullmatch("(" + NUMBER + r")(mm|cm|in|pt|px)", dimension, re.ASCII)
                if match is None or _number(match[1]) <= 0:
                    stop("INVALID_VIEWPORT_UNITS_OR_SIZE")
                if match[2] == "px":
                    findings.append(Finding("PHYSICAL_SIZE_UNKNOWN", index))
            viewport = (attrs["width"], attrs["height"])
            view_box = _numbers(attrs["viewBox"], 4)
            if view_box[2] <= 0 or view_box[3] <= 0:
                stop("INVALID_VIEWBOX")
        elif tag in GEOMETRY or tag == "path":
            if tag == "path":
                if "d" not in attrs:
                    stop("MISSING_GEOMETRY")
                values, bounds = _path(attrs["d"])
            else:
                fields = GEOMETRY[tag]
                required = {"rect": {"width", "height"}, "circle": {"r"}, "ellipse": {"rx", "ry"}, "line": set()}[tag]
                if required - attrs.keys():
                    stop("MISSING_GEOMETRY")
                values = tuple(_number(attrs.get(k, "0")) for k in fields)
                v = dict(zip(fields, values))
                if any(v[k] <= 0 for k in required):
                    stop("DEGENERATE_GEOMETRY")
                if tag == "rect":
                    bounds = (v["x"], v["y"], v["x"] + v["width"], v["y"] + v["height"])
                elif tag in {"circle", "ellipse"}:
                    rx, ry = (v["r"], v["r"]) if tag == "circle" else (v["rx"], v["ry"])
                    bounds = (v["cx"] - rx, v["cy"] - ry, v["cx"] + rx, v["cy"] + ry)
                else:
                    bounds = (min(v["x1"], v["x2"]), min(v["y1"], v["y2"]), max(v["x1"], v["x2"]), max(v["y1"], v["y2"]))
                    if v["x1"] == v["x2"] and v["y1"] == v["y2"]:
                        stop("DEGENERATE_GEOMETRY")
            x, y, width, height = view_box
            if bounds[0] < x or bounds[1] < y or bounds[2] > x + width or bounds[3] > y + height:
                stop("GEOMETRY_OUTSIDE_VIEWBOX")
            signature = (tag, values)
            if signature in signatures:
                duplicates.append((signatures[signature], index))
                findings.append(Finding("EXACT_COORDINATE_GEOMETRY_DUPLICATE", index))
            else:
                signatures[signature] = index
            extents = [size for size in (bounds[2] - bounds[0], bounds[3] - bounds[1]) if size > 0]
            primitives.append(Primitive(index, tag, tuple(_decimal_text(n) for n in bounds),
                                        _decimal_text(min(extents)) if extents else None))
        stack.append(tag)

    def characters(data):
        nonlocal text_chars
        text_chars += len(data)
        if text_chars > MAX_TEXT_CHARS:
            stop("TEXT_TOO_LARGE")
        if data.strip(" \t\r\n") and (not stack or stack[-1] not in {"title", "desc"}):
            stop("UNCONVERTED_TEXT_OR_FONT")

    parser.XmlDeclHandler = declaration
    parser.StartNamespaceDeclHandler = namespace
    parser.StartElementHandler = start
    parser.EndElementHandler = lambda name: stack.pop()
    parser.CharacterDataHandler = characters
    parser.StartDoctypeDeclHandler = lambda *args: stop("DTD_OR_ENTITY_FORBIDDEN")
    parser.EntityDeclHandler = lambda *args: stop("DTD_OR_ENTITY_FORBIDDEN")
    parser.ExternalEntityRefHandler = lambda *args: stop("EXTERNAL_ENTITY_FORBIDDEN")
    parser.ProcessingInstructionHandler = lambda *args: stop("PROCESSING_INSTRUCTION_FORBIDDEN")
    parser.StartCdataSectionHandler = lambda: stop("CDATA_UNSUPPORTED")
    try:
        # Exact arithmetic for bounded 64-character numbers with adjusted
        # exponent >= -64. Independent of the caller's Decimal context.
        with localcontext(Context(prec=160, rounding=ROUND_HALF_EVEN,
                                  Emin=-999999, Emax=999999, capitals=1, clamp=0,
                                  flags=[], traps=[InvalidOperation, DivisionByZero, Overflow])):
            parser.Parse(original, True)
        if not primitives:
            stop("NO_SUPPORTED_GEOMETRY")
        complete = True
        findings.append(Finding("MATERIAL_MACHINE_AND_PHYSICAL_QUALIFICATION_REQUIRED"))
        findings.append(Finding("STROKE_ENVELOPE_AND_TOPOLOGY_UNKNOWN"))
    except _Stop as exc:
        findings.append(Finding(exc.code, index))
    except expat.ExpatError:
        findings.append(Finding("MALFORMED_XML", index))
    return finish()
