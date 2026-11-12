"""Independent expected public shape for valid synthetic fixtures, not a validator."""
from copy import deepcopy

PUBLIC_FIELDS = (
    "id", "kind", "version", "status", "payment_status", "proof_status",
    "total_minor", "currency", "next_step", "test_payment_available",
    "current_proof_id", "current_proof_version", "approved_proof_version",
    "reservation_status", "test_hold_expires_at", "test_mode", "retail_test", "pricing_scope",
)
ITEM_FIELDS = ("product_slug", "quantity", "text", "secondary", "font", "personalization")


def expected_customer(document, availability=None):
    result = {key: deepcopy(document[key]) for key in PUBLIC_FIELDS if key in document}
    if availability is not None:
        result["test_payment_available"] = availability
    if "items" in document:
        result["items"] = [
            {key: deepcopy(value[key]) for key in ITEM_FIELDS if key in value}
            for value in document["items"]
        ]
    if "lines" in document:
        result["lines"] = []
        for line in document["lines"]:
            projected = {}
            if "item" in line:
                projected["item"] = {key: deepcopy(line["item"][key])
                                     for key in ITEM_FIELDS if key in line["item"]}
            if "personalization_snapshot" in line:
                projected["personalization_snapshot"] = deepcopy(line["personalization_snapshot"])
            result["lines"].append(projected)
    if "timeline" in document:
        result["timeline"] = [{"label": value["label"], "at": value["at"]}
                              for value in document["timeline"]]
    if "shipment" in document:
        result["shipment"] = {key: document["shipment"][key] for key in ("carrier", "tracking")}
    return result
