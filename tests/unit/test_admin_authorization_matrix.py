"""SS-081: synthetic admin boundary inventory, not production identity qualification."""
import json
import os
import re
import sqlite3
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI

from services.commerce.app.main import app
from test_commerce_workflows import connected, staff, auth, order

MANIFEST = Path(__file__).with_name("admin_route_inventory.json")
ROUTES = [tuple(item) for item in json.loads(MANIFEST.read_text(encoding="utf-8"))]


def logical_state():
    # Include every owned table and schema; denied calls must not create tables either.
    with sqlite3.connect(os.environ["SONORAN_DB_PATH"]) as db:
        schema = db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
        tables = [row[1] for row in schema if row[0] == "table"]
        return schema, {name: sorted(db.execute('SELECT * FROM "' + name.replace('"', '""') + '"').fetchall(),
                                    key=repr) for name in tables}


def target(path, record_id):
    return re.sub(r"\{([^}]+)\}", lambda m: record_id if m[1] == "record_id" else
                  "1" if m[1] == "revision" else "synthetic-boundary", path)


def admin_routes(routes, prefix=""):
    result = []
    for route in routes:
        if hasattr(route, "original_router"):
            result.extend(admin_routes(route.original_router.routes,
                                       prefix + route.include_context.prefix))
        elif hasattr(route, "path") and hasattr(route, "methods"):
            path = prefix + route.path
            if path.startswith("/v1/admin/"):
                result.extend((method.upper(), path) for method in route.methods)
        else:
            raise AssertionError("Unclassified route type requires authorization inventory review")
    return sorted(result)


def test_admin_inventory_is_complete_and_reviewed():
    assert admin_routes(app.routes) == sorted(ROUTES)
    assert len(ROUTES) == len(set(ROUTES)) == 41


def test_inventory_sees_schema_hidden_routes_and_nested_prefixes():
    probe = FastAPI()
    child = APIRouter()
    child.add_api_route("/hidden", lambda: {}, methods=["GET"], include_in_schema=False)
    outer = APIRouter()
    outer.include_router(child, prefix="/nested")
    probe.include_router(outer, prefix="/v1/admin")
    assert admin_routes(probe.routes) == [("GET", "/v1/admin/nested/hidden")]
    assert "/v1/admin/nested/hidden" not in probe.openapi()["paths"]


def test_inventory_rejects_unclassified_route_types():
    with pytest.raises(AssertionError, match="Unclassified route"):
        admin_routes([object()])


@pytest.mark.parametrize("method,path", ROUTES)
@pytest.mark.parametrize("credential", ["absent", "wrong", "customer", "basic", "query", "cookie"])
def test_every_admin_route_rejects_nonstaff_without_mutation(
        connected, monkeypatch, method, path, credential):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    receipt = order(connected)
    assert connected.get("/v1/admin/summary", headers=staff()).status_code == 200
    snapshot = logical_state()
    token = staff()["Authorization"].removeprefix("Bearer ")
    headers, params = {}, {}
    if credential == "wrong":
        headers = {"Authorization": "Bearer synthetic-wrong-staff"}
    elif credential == "customer":
        headers = auth(receipt)
    elif credential == "basic":
        headers = {"Authorization": "Basic " + token}
    elif credential == "query":
        params = {"access_token": token, "token": token, "authorization": "Bearer " + token}
    elif credential == "cookie":
        headers = {"Cookie": "access_token=" + token + "; session=" + token}
    response = connected.request(method, target(path, receipt["id"]), headers=headers,
                                 params=params, json={} if method != "GET" else None)
    assert response.status_code == 401
    assert set(response.json()) == {"error", "request_id"}
    assert response.json()["error"] == {"code": "ACCESS_REQUIRED",
                                        "message": "Staff access could not be verified.", "retryable": False}
    assert logical_state() == snapshot
    # Response cannot echo submitted credentials. Access-log URL policy is separately assessed.
    for sentinel in (token, receipt["access_token"], "synthetic-wrong-staff"):
        assert sentinel not in response.text


@pytest.mark.parametrize("method,path", ROUTES)
@pytest.mark.parametrize("gate", ["requests-disabled", "production-stage", "missing-secret"])
def test_every_admin_route_fails_closed_before_mutation(connected, monkeypatch, method, path, gate):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    receipt = order(connected)
    snapshot = logical_state()
    if gate == "requests-disabled":
        monkeypatch.setenv("SONORAN_REQUESTS_ENABLED", "false")
    elif gate == "production-stage":
        monkeypatch.setenv("SONORAN_STAGE", "production")
    else:
        monkeypatch.delenv("SONORAN_ACCESS_SECRET")
    response = connected.request(method, target(path, receipt["id"]), headers=staff(),
                                 json={} if method != "GET" else None)
    assert response.status_code == 503
    assert logical_state() == snapshot
    assert receipt["access_token"] not in response.text


def test_staff_rotation_invalidates_old_fixture_token_without_losing_customer_access(connected, monkeypatch):
    receipt = order(connected)
    old = staff()
    snapshot = logical_state()
    new = "synthetic-rotated-staff-" + "y" * 40
    monkeypatch.setenv("SONORAN_STAFF_TOKEN", new)
    assert connected.get("/v1/admin/summary", headers=old).status_code == 401
    assert connected.get("/v1/admin/summary", headers={"Authorization": "Bearer " + new}).status_code == 200
    assert connected.get("/v1/orders/" + receipt["id"], headers=auth(receipt)).status_code == 200
    assert logical_state() == snapshot
