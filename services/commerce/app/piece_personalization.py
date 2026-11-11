"""Explicit test-only piece assignments; never inferred from stock consumption."""
from typing import Annotated, Literal
import unicodedata

from fastapi import HTTPException
from pydantic import Field, StrictInt, ValidationError, field_validator, model_validator

from services.commerce.app.workflows import StrictModel


def inscription(value):
    if not value.strip() or any(unicodedata.category(c) in {"Cc", "Cs"} for c in value):
        raise ValueError("Use nonblank text without control characters or surrogate code points.")
    return value


class Identical(StrictModel):
    mode: Literal["identical"]
    text: str = Field(min_length=1, max_length=120)
    _text = field_validator("text")(inscription)


class Piece(StrictModel):
    set_index: StrictInt = Field(ge=0, le=499)
    piece_index: StrictInt = Field(ge=0, le=99)
    text: str = Field(min_length=1, max_length=120)
    _text = field_validator("text")(inscription)


class PerPiece(StrictModel):
    mode: Literal["per_piece"]
    pieces: list[Piece] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def unique_positions(self):
        if len({(p.set_index, p.piece_index) for p in self.pieces}) != len(self.pieces):
            raise ValueError("Use each piece position once.")
        return self


Personalization = Annotated[Identical | PerPiece, Field(discriminator="mode")]
CRYSTAL_KEYS = {"Crystal shape", "Size", "Orientation"}


def piece_snapshot(item, offer, line_index):
    """Called after request/persisted item validation, within cart transaction."""
    if "personalization" not in item:
        return None
    count = offer.get("pieces_per_item")
    if type(count) is not int or not 1 <= count <= 100:
        raise HTTPException(409, "This test offer needs an explicit valid piece count.")
    quantity = item["quantity"]
    total = quantity * count
    if total > 500:
        raise HTTPException(422, "Explicit personalization supports at most 500 pieces per line.")
    data = item["personalization"]
    expected = {(s, p) for s in range(quantity) for p in range(count)}
    if data["mode"] == "identical":
        pieces = [{"set_index": s, "piece_index": p, "text": data["text"]} for s, p in sorted(expected)]
    else:
        pieces = data["pieces"]
        if {(p["set_index"], p["piece_index"]) for p in pieces} != expected:
            raise HTTPException(422, "Provide exactly one assignment for every piece of every purchased set.")
        pieces = sorted(pieces, key=lambda p: (p["set_index"], p["piece_index"]))
    return {"schema_version": 1, "mode": data["mode"], "line_index": line_index,
            "quantity": quantity, "pieces_per_item": count, "pieces": pieces}


def validate_persisted_items(items, model):
    """Only new structured items are revalidated; legacy snapshots are not rewritten."""
    if not isinstance(items, list):
        raise HTTPException(409, "Stored cart configuration needs reconciliation.")
    for item in items:
        if not isinstance(item, dict):
            raise HTTPException(409, "Stored cart configuration needs reconciliation.")
        if "personalization" in item:
            try:
                model.model_validate(item)
            except (ValidationError, TypeError, ValueError):
                raise HTTPException(409, "Stored piece configuration needs reconciliation.") from None


def validate_stored_snapshot(lines, items):
    """Strict compare avoids bool/int equality accepting corrupt persisted snapshots."""
    import json
    for index, item in enumerate(items):
        if "personalization" not in item:
            continue
        if not isinstance(lines, list) or index >= len(lines) or not isinstance(lines[index], dict):
            raise HTTPException(409, "Stored piece mapping needs reconciliation.")
        line = lines[index]
        stored = line.get("personalization_snapshot")
        if not isinstance(stored, dict) or type(stored.get("pieces_per_item")) is not int:
            raise HTTPException(409, "Stored piece mapping needs reconciliation.")
        try:
            expected = piece_snapshot(item, {"pieces_per_item": stored["pieces_per_item"]}, index)
        except HTTPException:
            raise HTTPException(409, "Stored piece mapping needs reconciliation.") from None
        if json.dumps(stored, sort_keys=True) != json.dumps(expected, sort_keys=True):
            raise HTTPException(409, "Stored piece mapping needs reconciliation.")
