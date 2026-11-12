"""Allowlisted customer order responses; never a persistence or staff projection."""
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal
import re
import unicodedata

from fastapi import HTTPException
from pydantic import AfterValidator, ConfigDict, Field, TypeAdapter, ValidationError, with_config
from typing_extensions import NotRequired, TypedDict

SAFE_INTEGER = 9007199254740991
CLOSED = ConfigDict(extra="forbid", strict=True)


def unicode_text(value):
    if any(unicodedata.category(c) == "Cs" for c in value):
        raise ValueError("Invalid Unicode")
    return value


def single_line(value):
    unicode_text(value)
    if any(unicodedata.category(c) == "Cc" for c in value):
        raise ValueError("Invalid control character")
    return value


def timestamp(value):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value):
        raise ValueError("Explicit recorded timestamp required")
    if not value.endswith("Z") and (int(value[-5:-3]) > 23 or int(value[-2:]) > 59):
        raise ValueError("Invalid recorded timezone")
    if datetime.fromisoformat(value).utcoffset() is None:
        raise ValueError("Explicit recorded timezone required")
    return value  # Preserve the original string; never normalize its timezone.


Identifier = Annotated[str, Field(strict=True, min_length=1, max_length=100), AfterValidator(single_line)]
Status = Annotated[str, Field(strict=True, min_length=1, max_length=80), AfterValidator(single_line)]
LegacyText = Annotated[str, Field(strict=True, max_length=120), AfterValidator(unicode_text)]
RecordedTime = Annotated[str, Field(strict=True, max_length=64), AfterValidator(timestamp)]
Positive = Annotated[int, Field(strict=True, ge=1, le=SAFE_INTEGER)]
Nonnegative = Annotated[int, Field(strict=True, ge=0, le=SAFE_INTEGER)]
Quantity = Annotated[int, Field(strict=True, ge=1, le=500)]
Font = Literal["", "Classic serif", "Modern sans", "Handwritten"]


@with_config(CLOSED)
class CustomerPiece(TypedDict):
    set_index: Annotated[int, Field(strict=True, ge=0, le=499)]
    piece_index: Annotated[int, Field(strict=True, ge=0, le=99)]
    text: Annotated[str, Field(strict=True, min_length=1, max_length=120), AfterValidator(unicode_text)]


@with_config(CLOSED)
class IdenticalText(TypedDict):
    mode: Literal["identical"]
    text: Annotated[str, Field(strict=True, min_length=1, max_length=120), AfterValidator(unicode_text)]


@with_config(CLOSED)
class PieceText(TypedDict):
    mode: Literal["per_piece"]
    pieces: Annotated[list[CustomerPiece], Field(min_length=1, max_length=500)]


@with_config(CLOSED)
class CustomerItem(TypedDict):
    product_slug: Identifier
    quantity: Quantity
    text: NotRequired[LegacyText]
    secondary: NotRequired[LegacyText]
    font: NotRequired[Font]
    personalization: NotRequired[Annotated[IdenticalText | PieceText, Field(discriminator="mode")]]


@with_config(CLOSED)
class CustomerSnapshot(TypedDict):
    schema_version: Annotated[int, Field(strict=True, ge=1, le=1)]
    mode: Literal["identical", "per_piece"]
    line_index: Annotated[int, Field(strict=True, ge=0, le=99)]
    quantity: Quantity
    pieces_per_item: Annotated[int, Field(strict=True, ge=1, le=100)]
    pieces: Annotated[list[CustomerPiece], Field(min_length=1, max_length=500)]


@with_config(CLOSED)
class CustomerLine(TypedDict):
    item: NotRequired[CustomerItem]
    personalization_snapshot: NotRequired[CustomerSnapshot]


@with_config(CLOSED)
class CustomerEvent(TypedDict):
    label: Annotated[str, Field(strict=True, min_length=1, max_length=500), AfterValidator(single_line)]
    at: RecordedTime


@with_config(CLOSED)
class CustomerShipment(TypedDict):
    carrier: Annotated[str, Field(strict=True, min_length=1, max_length=200), AfterValidator(single_line)]
    tracking: Annotated[str, Field(strict=True, min_length=1, max_length=500), AfterValidator(single_line)]


@with_config(CLOSED)
class CustomerOrder(TypedDict):
    id: Identifier
    kind: Literal["order"]
    version: Positive
    status: Status
    payment_status: Status
    proof_status: Status
    total_minor: Nonnegative | None
    currency: Annotated[str, Field(strict=True, min_length=3, max_length=3), AfterValidator(single_line)]
    next_step: NotRequired[Annotated[str, Field(strict=True, max_length=3000), AfterValidator(single_line)]]
    test_payment_available: NotRequired[bool]
    items: NotRequired[Annotated[list[CustomerItem], Field(max_length=100)]]
    lines: NotRequired[Annotated[list[CustomerLine], Field(max_length=100)]]
    timeline: NotRequired[Annotated[list[CustomerEvent], Field(max_length=1000)]]
    shipment: NotRequired[CustomerShipment]
    current_proof_id: NotRequired[Identifier | None]
    current_proof_version: NotRequired[Nonnegative]
    approved_proof_version: NotRequired[Nonnegative | None]
    reservation_status: NotRequired[Status]
    test_hold_expires_at: NotRequired[RecordedTime]
    test_mode: NotRequired[bool]
    retail_test: NotRequired[bool]
    pricing_scope: NotRequired[Annotated[str, Field(strict=True, min_length=1, max_length=500), AfterValidator(single_line)]]


ORDER_FIELDS = (
    "id", "kind", "version", "status", "payment_status", "proof_status",
    "total_minor", "currency", "next_step", "test_payment_available",
    "current_proof_id", "current_proof_version", "approved_proof_version",
    "reservation_status", "test_hold_expires_at", "test_mode", "retail_test", "pricing_scope",
)
ORDER_ADAPTER = TypeAdapter(CustomerOrder)


def invalid():
    raise ValueError("Order response needs reconciliation")


def bounded_text(value, maximum, minimum=0, controls=True):
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        invalid()
    (unicode_text if controls else single_line)(value)
    return value


def integer(value, minimum, maximum):
    if type(value) is not int or not minimum <= value <= maximum:
        invalid()
    return value


@lru_cache(maxsize=1)
def assignment_adapter():
    # Lazy import avoids any module-init cycle with the existing workflow models.
    from services.commerce.app.piece_personalization import Personalization
    return TypeAdapter(Personalization)


def assignment(value):
    parsed = assignment_adapter().validate_python(value, strict=True).model_dump(mode="json")
    if parsed["mode"] == "identical":
        return parsed, ("identical", parsed["text"])
    return parsed, ("per_piece", tuple(sorted(
        (p["set_index"], p["piece_index"], p["text"]) for p in parsed["pieces"]
    )))


def item(value):
    if not isinstance(value, dict):
        invalid()
    slug = bounded_text(value.get("product_slug"), 100, 1, controls=False)
    quantity = integer(value.get("quantity"), 1, 500)
    primary = bounded_text(value.get("text", ""), 120)
    secondary = bounded_text(value.get("secondary", ""), 120)
    font = value.get("font", "")
    if font not in ("", "Classic serif", "Modern sans", "Handwritten"):
        invalid()
    options = value.get("options", {})
    if not isinstance(options, dict) or len(options) > 16:
        invalid()
    for key, val in options.items():
        bounded_text(key, 60)
        bounded_text(val, 200)
    output = {"product_slug": slug, "quantity": quantity}
    for key in ("text", "secondary", "font"):
        if key in value:
            output[key] = value[key]
    normalized = None
    if "personalization" in value:
        if primary != "" or secondary != "" or not set(options) <= {"Crystal shape", "Size", "Orientation"}:
            invalid()
        output["personalization"], normalized = assignment(value["personalization"])
    material = (slug, quantity, primary, secondary, font, tuple(sorted(options.items())), normalized)
    return output, material


def snapshot(value, raw_item, material, line_index):
    fields = {"schema_version", "mode", "line_index", "quantity", "pieces_per_item", "pieces"}
    if not isinstance(value, dict) or set(value) != fields:
        invalid()
    integer(value["schema_version"], 1, 1)
    integer(value["line_index"], 0, 99)
    integer(value["quantity"], 1, 500)
    count = integer(value["pieces_per_item"], 1, 100)
    quantity = material[1]
    total = count * quantity
    if total > 500 or value["line_index"] != line_index or value["quantity"] != quantity:
        invalid()
    parsed, normalized = assignment(raw_item["personalization"])
    if value["mode"] != parsed["mode"]:
        invalid()
    checked, _ = assignment({"mode": "per_piece", "pieces": value["pieces"]})
    if parsed["mode"] == "identical":
        expected = [{"set_index": s, "piece_index": p, "text": parsed["text"]}
                    for s in range(quantity) for p in range(count)]
    else:
        expected = [{"set_index": s, "piece_index": p, "text": text} for s, p, text in normalized[1]]
        if len(expected) != total or any(
            p["set_index"] != n // count or p["piece_index"] != n % count
            for n, p in enumerate(expected)
        ):
            invalid()
    if checked["pieces"] != expected:
        invalid()
    return {"schema_version": 1, "mode": parsed["mode"], "line_index": line_index,
            "quantity": quantity, "pieces_per_item": count, "pieces": checked["pieces"]}, total


def configuration(source):
    output, parsed_items = {}, []
    if "items" in source:
        if not isinstance(source["items"], list) or len(source["items"]) > 100:
            invalid()
        parsed_items = [item(v) for v in source["items"]]
        output["items"] = [v[0] for v in parsed_items]
    structured = any(v[1][-1] is not None for v in parsed_items)
    lines = source.get("lines", [])
    if "lines" in source and (not isinstance(lines, list) or len(lines) > 100):
        invalid()
    if structured and ("lines" not in source or len(lines) != len(parsed_items)):
        invalid()
    projected, pieces = [], 0
    for index, line in enumerate(lines):
        if not isinstance(line, dict):
            invalid()
        result = {}
        current = parsed_items[index] if index < len(parsed_items) else None
        if "item" in line:
            if current is None:
                invalid()
            safe_item, material = item(line["item"])
            if material != current[1]:
                invalid()
            result["item"] = safe_item
        has_snapshot = "personalization_snapshot" in line
        if has_snapshot:
            if current is None or current[1][-1] is None or "item" not in result:
                invalid()
            result["personalization_snapshot"], count = snapshot(
                line["personalization_snapshot"], source["items"][index], current[1], index
            )
            pieces += count
            if pieces > 2000:
                invalid()
        elif current is not None and current[1][-1] is not None:
            invalid()
        projected.append(result)
    if "lines" in source:
        output["lines"] = projected
    return output


def customer_order(source, expected_id=None) -> CustomerOrder:
    """Validate original material, then copy only explicitly public fields.

    Unknown metadata is dropped, not interpreted. Malformed mapping is never
    repaired by reconstructing a canonical line from another source.
    """
    try:
        if not isinstance(source, dict) or (expected_id is not None and source.get("id") != expected_id):
            invalid()
        output = {key: source[key] for key in ORDER_FIELDS if key in source}
        output.update(configuration(source))
        if "timeline" in source:
            timeline = source["timeline"]
            if not isinstance(timeline, list) or len(timeline) > 1000:
                invalid()
            output["timeline"] = [
                {"label": row["label"], "at": row["at"]} if isinstance(row, dict) else invalid()
                for row in timeline
            ]
        if "shipment" in source:
            shipment = source["shipment"]
            if not isinstance(shipment, dict):
                invalid()
            output["shipment"] = {"carrier": shipment["carrier"], "tracking": shipment["tracking"]}
        return ORDER_ADAPTER.validate_python(output, strict=True)
    except (KeyError, TypeError, ValueError, ValidationError):
        raise HTTPException(409, "This order response needs reconciliation. Contact the studio.") from None
