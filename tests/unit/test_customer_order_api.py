"""Synthetic-only customer response minimization and cancellation atomicity."""
from copy import deepcopy
import json
import os
import sqlite3
from uuid import uuid4

from fastapi import HTTPException
import pytest

from services.commerce.app import retail
from services.commerce.app.main import app
from services.commerce.app.workflows import database, load, save
from test_commerce_workflows import connected, staff, auth, order
from test_retail_durability import setup, cart, purchase, SLUG
from test_piece_personalization import configured, create, item as assigned_item
from customer_order_oracle import expected_customer, PUBLIC_FIELDS, ITEM_FIELDS


def seed(c, monkeypatch):
    configured(c, monkeypatch, count=2, units=7)
    values = [
        assigned_item(personalization={"mode": "identical", "text": " \ufeff Café 🌵 "}),
        assigned_item(personalization={"mode": "per_piece", "pieces": [
            {"set_index": 0, "piece_index": 1, "text": "SECOND"},
            {"set_index": 0, "piece_index": 0, "text": " FIRST "},
        ]}),
    ]
    response = create(c, values)
    assert response.status_code == 200, response.text
    receipt = purchase(c, response.json())
    assert receipt.status_code == 200, receipt.text
    return receipt.json(), response.json()


def internal(c, receipt):
    response = c.get("/v1/admin/records/" + receipt["id"], headers=staff())
    assert response.status_code == 200, response.text
    return response.json()


def mutate(receipt, change):
    with database() as db:
        document = load(db, receipt["id"])
        change(document)
        save(db, document)


def logical_database():
    # Complete owned-fixture logical state, not a projection of selected tables.
    with sqlite3.connect(os.environ["SONORAN_DB_PATH"]) as db:
        names = db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        return {name: sorted(db.execute('SELECT * FROM "' + name.replace('"', '""') + '"').fetchall(),
                             key=repr) for (name,) in names}


def get(c, receipt, token=None):
    return c.get("/v1/orders/" + receipt["id"],
                 headers=auth(receipt) if token is None else {"Authorization": "Bearer " + token})


def cancel(c, receipt, version=1):
    return c.post("/v1/orders/" + receipt["id"] + "/cancel-test",
                  json={"version": version}, headers=auth(receipt))


def test_network_projection_exact_allowlist_and_nonmutation(connected, monkeypatch):
    receipt, cart_receipt = seed(connected, monkeypatch)

    def metadata(doc):
        doc.update(staff_notes="PRIVATE-SENTINEL", token_hash="PRIVATE-SENTINEL",
                   access_token="PRIVATE-SENTINEL", checkout_session_id="PRIVATE-SENTINEL",
                   payment_provider="PRIVATE-SENTINEL")
        doc["timeline"][0]["actor"] = "PRIVATE-SENTINEL"
        doc["shipment"] = {"carrier": "Synthetic carrier", "tracking": "TEST",
                           "provider_reference": "PRIVATE-SENTINEL"}
        for value in doc["items"] + [line["item"] for line in doc["lines"]]:
            value.update(notes="PRIVATE-SENTINEL", artwork_name="PRIVATE-SENTINEL",
                         gift_message="PRIVATE-SENTINEL",
                         photo_brief={"filename": "PRIVATE-SENTINEL"})
        for line in doc["lines"]:
            line["supplier_cost"] = "PRIVATE-SENTINEL"
    mutate(receipt, metadata)
    before = internal(connected, receipt)
    snapshot = logical_database()
    response = get(connected, receipt)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body == expected_customer(before, availability=False)
    assert set(body) <= set(PUBLIC_FIELDS) | {"items", "lines", "timeline", "shipment"}
    assert all(set(v) <= set(ITEM_FIELDS) for v in body["items"])
    assert all(set(v) <= {"item", "personalization_snapshot"} for v in body["lines"])
    assert "PRIVATE-SENTINEL" not in json.dumps(body)
    assert body["items"][1]["personalization"]["pieces"][0]["piece_index"] == 1
    assert body["lines"][1]["personalization_snapshot"]["pieces"][0]["piece_index"] == 0
    assert body["current_proof_id"] is None and body["approved_proof_version"] is None
    assert len(body["lines"][0]["personalization_snapshot"]["pieces"]) == 2
    assert before["lines"][0]["stock_units"] == 7
    assert internal(connected, receipt) == before and logical_database() == snapshot
    assert get(connected, receipt, cart_receipt["access_token"]).status_code == 404
    assert get(connected, receipt, "wrong").status_code == 404


def test_unknown_hidden_only_changes_do_not_change_customer_response(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    before = get(connected, receipt).json()
    def change(doc):
        doc["internal_revision"] = {"opaque": "PRIVATE"}
        doc["items"][0]["notes"] = "PRIVATE"
        doc["lines"][0]["item"]["notes"] = "different PRIVATE"
    mutate(receipt, change)
    assert get(connected, receipt).json() == before


def test_customer_cancel_is_projected_exact_once_and_replay_preserves_full_state(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    response = cancel(connected, receipt)
    assert response.status_code == 200, response.text
    document = internal(connected, receipt)
    assert response.json() == expected_customer(document)
    assert response.json()["status"] == "cancelled"
    assert "inventory_reserved" not in response.json()
    assert document["inventory_reserved"] is False
    assert sum(v["label"] == "Test order cancelled and reservation released"
               for v in document["timeline"]) == 1
    snapshot = logical_database()
    assert cancel(connected, receipt).json() == response.json()
    assert logical_database() == snapshot and internal(connected, receipt) == document
    assert get(connected, receipt).json() == expected_customer(document, availability=False)


def test_cancel_prospective_projection_failure_rolls_back_every_table(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    snapshot = logical_database()
    original = retail.customer_order
    calls = []
    def fail_after_transition(doc, *context):
        calls.append(doc["status"])
        if doc["status"] == "cancelled":
            raise HTTPException(409, "Synthetic prospective projection failure")
        return original(doc, *context)
    monkeypatch.setattr(retail, "customer_order", fail_after_transition)
    assert cancel(connected, receipt).status_code == 409
    assert calls == ["awaiting_payment", "cancelled"]
    assert logical_database() == snapshot
    assert internal(connected, receipt)["inventory_reserved"] is True


def test_cancel_original_projection_failure_prevents_writes(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    snapshot = logical_database()
    def fail(doc, *context):
        raise HTTPException(409, "Synthetic original projection failure")
    monkeypatch.setattr(retail, "customer_order", fail)
    assert cancel(connected, receipt).status_code == 409
    assert logical_database() == snapshot


def drop_snapshot(doc):
    del doc["lines"][0]["personalization_snapshot"]


def orphan_snapshot(doc):
    del doc["items"][0]["personalization"]
    del doc["lines"][0]["item"]["personalization"]


BAD = {
    "missing snapshot": drop_snapshot,
    "orphan snapshot": orphan_snapshot,
    "null snapshot": lambda d: d["lines"][0].update(personalization_snapshot=None),
    "unknown snapshot keys": lambda d: d["lines"][0]["personalization_snapshot"].update(hidden="PRIVATE"),
    "wrong line identity": lambda d: d["lines"][0]["item"].update(product_slug="other"),
    "wrong line quantity": lambda d: d["lines"][0]["item"].update(quantity=2),
    "wrong line font": lambda d: d["lines"][0]["item"].update(font="Handwritten"),
    "wrong line assignment": lambda d: d["lines"][0]["item"]["personalization"].update(text="wrong"),
    "missing line item": lambda d: d["lines"][0].pop("item"),
    "null item": lambda d: d["items"].__setitem__(0, None),
    "bool quantity": lambda d: d["items"][0].update(quantity=True),
    "competing legacy text": lambda d: d["items"][0].update(text="wrong"),
    "invalid options": lambda d: d["items"][0].update(options=None),
    "unsupported structured options": lambda d: d["items"][0].update(options={"Private": "PRIVATE"}),
    "null assignment": lambda d: d["items"][0].update(personalization=None),
    "extra assignment keys": lambda d: d["items"][0]["personalization"].update(hidden="PRIVATE"),
    "bool schema": lambda d: d["lines"][0]["personalization_snapshot"].update(schema_version=True),
    "bool line": lambda d: d["lines"][0]["personalization_snapshot"].update(line_index=False),
    "bool count": lambda d: d["lines"][0]["personalization_snapshot"].update(pieces_per_item=True),
    "snapshot count mismatch": lambda d: d["lines"][0]["personalization_snapshot"].update(quantity=2),
    "bool piece": lambda d: d["lines"][0]["personalization_snapshot"]["pieces"][0].update(piece_index=False),
    "snapshot wording": lambda d: d["lines"][0]["personalization_snapshot"]["pieces"][0].update(text="wrong"),
    "snapshot order": lambda d: d["lines"][0]["personalization_snapshot"]["pieces"].reverse(),
    "missing lines": lambda d: d.pop("lines"),
    "null lines": lambda d: d.update(lines=None),
    "wrong font": lambda d: d["items"][0].update(font="invented"),
    "bad timeline": lambda d: d["timeline"][0].update(at="2030-01-01T00:00:00+00:60"),
}
@pytest.mark.parametrize("damage", BAD)
def test_malformed_material_is_not_repaired_and_cannot_release_stock(connected, monkeypatch, damage):
    receipt, _ = seed(connected, monkeypatch)
    mutate(receipt, BAD[damage])
    snapshot = logical_database()
    assert get(connected, receipt).status_code == 409
    assert cancel(connected, receipt).status_code == 409
    assert logical_database() == snapshot
    assert internal(connected, receipt)["inventory_reserved"] is True


def test_customer_contract_null_optional_and_closed_nested_schemas():
    schemas = app.openapi()["components"]["schemas"]
    public = schemas["CustomerOrder"]
    assert public["additionalProperties"] is False
    assert "items" not in public["required"] and "lines" not in public["required"]
    assert any(v.get("type") == "null" for v in public["properties"]["total_minor"]["anyOf"])
    assert public["properties"]["items"].get("type") == "array"
    for name in ("CustomerItem", "CustomerLine", "CustomerSnapshot", "CustomerShipment", "CustomerEvent"):
        assert schemas[name]["additionalProperties"] is False


def test_legacy_absent_empty_multiline_and_unicode_are_preserved():
    from services.commerce.app.customer_orders import customer_order
    base = dict(id="ord_legacy", kind="order", version=1, status="pending",
                payment_status="unpaid", proof_status="awaiting_proof",
                total_minor=None, currency="USD")
    assert customer_order(base) == base
    assert customer_order({**base, "items": []})["items"] == []
    value = {**base, "items": [{"product_slug": "legacy", "quantity": 1,
              "text": ' first\n"quote"\\last\t', "secondary": " other\r\n", "font": ""}]}
    assert customer_order(value) == value
    value["items"][0]["text"] = "🌵" * 120
    assert customer_order(value) == value
    for bad in (None, "x", {}, [None]):
        with pytest.raises(HTTPException):
            customer_order({**base, "items": bad})


def test_legacy_quote_status_fields_auth_and_disabled_gates_remain(connected, monkeypatch):
    receipt = order(connected)
    body = get(connected, receipt)
    assert body.status_code == 200, body.text
    assert body.json()["approved_proof_version"] is None
    assert body.json()["current_proof_id"] is None
    assert "lines" not in body.json()
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    assert cancel(connected, receipt).status_code == 409
    monkeypatch.setenv("SONORAN_REQUESTS_ENABLED", "false")
    assert get(connected, receipt).status_code == 503
    assert cancel(connected, receipt).status_code == 503


def legacy_document():
    return dict(id="ord_legacy", kind="order", version=1, status="pending",
                payment_status="unpaid", proof_status="awaiting_proof",
                total_minor=None, currency="USD")


@pytest.mark.parametrize("field,value", [
    ("version", True), ("version", 9007199254740992), ("total_minor", True),
    ("total_minor", -1), ("currency", 1), ("test_mode", 1), ("retail_test", None),
    ("current_proof_version", -1), ("current_proof_version", None),
    ("current_proof_id", 1), ("approved_proof_version", False),
    ("next_step", None), ("items", None), ("lines", None), ("shipment", None), ("timeline", None),
])
def test_present_malformed_fields_are_not_coerced_or_defaulted(field, value):
    from services.commerce.app.customer_orders import customer_order
    with pytest.raises(HTTPException) as failure:
        customer_order({**legacy_document(), field: value})
    assert failure.value.status_code == 409


@pytest.mark.parametrize("value", [
    "2026-02-30T00:00:00Z", "1900-02-29T00:00:00Z", "0000-01-01T00:00:00Z",
    "2026-11-11T24:00:00Z", "2026-11-11T00:00:00+24:00",
    "2026-11-11T00:00:00+00:60", "2026-11-11T00:00:00",
])
def test_recorded_timestamps_never_normalize_invalid_source(value):
    from services.commerce.app.customer_orders import customer_order
    with pytest.raises(HTTPException):
        customer_order({**legacy_document(), "timeline": [{"label": "Private", "at": value}]})


@pytest.mark.parametrize("value", [
    "0001-01-01T00:00:00Z", "2000-02-29T12:34:56.123456+00:00",
    "9999-12-31T23:59:59-07:00", "2026-11-11T00:00:00+23:59",
])
def test_recorded_timestamps_retain_exact_original_timezone(value):
    from services.commerce.app.customer_orders import customer_order
    document = {**legacy_document(), "timeline": [{"label": "Same", "at": value}] * 2}
    assert customer_order(document)["timeline"] == document["timeline"]


def test_largest_supported_items_timeline_and_unallocated_quantity_remain_bounded():
    from services.commerce.app.customer_orders import customer_order
    source = {**legacy_document(), "items": [{"product_slug": "legacy", "quantity": 500}] * 100,
              "timeline": [{"label": "Same", "at": "2026-11-11T00:00:00Z"}] * 1000}
    original = deepcopy(source)
    result = customer_order(source)
    assert result == source == original
    assert len(result["items"]) == 100  # No inferred per-piece expansion.
    for field, extra in (("items", source["items"][0]), ("timeline", source["timeline"][0])):
        bad = deepcopy(source)
        bad[field].append(extra)
        with pytest.raises(HTTPException):
            customer_order(bad)


def test_global_piece_limit_preserves_positional_same_sku_lines():
    from services.commerce.app.customer_orders import customer_order
    source = {**legacy_document(), "items": [], "lines": []}
    for index in range(5):
        value = {"product_slug": "legacy", "quantity": 5,
                 "personalization": {"mode": "identical", "text": "Line " + str(index)}}
        mapping = {"schema_version": 1, "mode": "identical", "line_index": index,
                   "quantity": 5, "pieces_per_item": 100, "pieces": [
                       {"set_index": n // 100, "piece_index": n % 100, "text": "Line " + str(index)}
                       for n in range(500)]}
        source["items"].append(value)
        source["lines"].append({"item": deepcopy(value), "personalization_snapshot": mapping})
    with pytest.raises(HTTPException):
        customer_order(source)
    source["items"].pop()
    source["lines"].pop()
    assert customer_order(source) == source
    assert len(source["lines"]) == 4 and source["lines"][3]["personalization_snapshot"]["line_index"] == 3


def test_invalid_source_error_never_echoes_private_metadata(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    mutate(receipt, lambda doc: doc["items"][0].update(font="PRIVATE-INVALID-SENTINEL"))
    response = get(connected, receipt)
    assert response.status_code == 409
    assert "PRIVATE-INVALID-SENTINEL" not in response.text
    assert "items" not in response.json()


def test_corrupt_stored_record_identity_cannot_redirect_response_or_cancel(connected, monkeypatch):
    receipt, _ = seed(connected, monkeypatch)
    with database() as db:
        value = load(db, receipt["id"])
        value["id"] = "ord_foreign_not_authorized"
        # Deliberately corrupt only this owned row, without using save(new id).
        db.execute("UPDATE records SET document=? WHERE id=?", (json.dumps(value), receipt["id"]))
    original = logical_database()
    assert get(connected, receipt).status_code == 409
    assert cancel(connected, receipt).status_code == 409
    assert logical_database() == original


@pytest.mark.parametrize("count", [999, 1000])
def test_cancel_event_bound_is_atomic_without_mocking_projection(connected, monkeypatch, count):
    receipt, _ = seed(connected, monkeypatch)
    def events(doc):
        doc["timeline"] = [{"label": "Recorded event", "at": "2026-11-11T00:00:00Z"}
                           for _ in range(count)]
    mutate(receipt, events)
    assert get(connected, receipt).status_code == 200
    before = logical_database()
    response = cancel(connected, receipt)
    if count == 1000:
        assert response.status_code == 409
        assert logical_database() == before
        assert internal(connected, receipt)["status"] == "awaiting_payment"
    else:
        assert response.status_code == 200
        assert len(internal(connected, receipt)["timeline"]) == 1000
        after = logical_database()
        assert cancel(connected, receipt).json() == response.json()
        assert logical_database() == after
