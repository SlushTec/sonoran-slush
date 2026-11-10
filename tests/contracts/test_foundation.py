from pathlib import Path
import json
import pytest
from fastapi.testclient import TestClient
from services.commerce.app.main import app as commerce
from services.assistant.app.main import app as assistant
from services.common.runtime import create_app
from scripts.verify_archive import verify
from scripts.export_contracts import export

ROOT=Path(__file__).resolve().parents[2]
client=TestClient(commerce)

def test_archive_complete_and_business_sources_unchanged():
    result=verify()
    assert result["archived_files_verified"] == 67
    assert result["unchanged_business_files_verified"] == 41

def test_generated_contracts_match_source():
    export(check=True)

@pytest.mark.parametrize("app",[commerce,assistant])
def test_health_is_not_readiness(app):
    with TestClient(app) as c:
        health=c.get("/health")
        assert health.status_code==200 and health.json()["live_integrations"] is False
        assert c.get("/ready").status_code==503

def test_catalog_has_no_purchasable_or_priced_fixtures():
    data=client.get("/v1/catalog").json()
    assert data["production_approved"] is False
    assert len(data["categories"])==7
    assert len({p["slug"] for p in data["products"]})==len(data["products"])
    for p in data["products"]:
        assert p["price_minor"] is None and p["purchasable"] is False
        for source in p["source_paths"]:
            assert (ROOT/source).is_file()

def test_search_and_unknown_product():
    assert len(client.get("/v1/products",params={"q":"decanter"}).json())==2
    assert client.get("/v1/products/not-real").status_code==404
    assert client.get("/v1/products",params={"q":"x"*101}).status_code==422

@pytest.mark.parametrize("path",["/v1/cart","/v1/checkout/sessions","/v1/uploads","/v1/quotes","/v1/events/requests","/v1/proofs/example/approve","/v1/webhooks/payments"])
def test_mutations_fail_closed_without_echoing_customer_input(path):
    response=client.post(path,json={"private":"do-not-echo"})
    assert response.status_code==503
    assert response.json()["error"]["code"]=="NOT_IMPLEMENTED"
    assert "do-not-echo" not in response.text
    assert response.headers["x-request-id"]

def test_customer_record_lookup_is_disabled():
    assert client.get("/v1/orders/another-customer").status_code==503

def test_assistant_disabled_and_input_validation():
    with TestClient(assistant) as c:
        response=c.post("/v1/assist",json={"message":"Help me choose a gift"})
        assert response.status_code==503 and response.json()["error"]["code"]=="ASSISTANT_DISABLED"
        assert c.post("/v1/assist",json={"message":""}).status_code==422
        assert c.post("/v1/assist",json={"message":"gift","tool":"charge"}).status_code==422

def test_production_mode_is_refused(monkeypatch):
    monkeypatch.setenv("SONORAN_STAGE","production")
    with pytest.raises(RuntimeError):
        create_app("should-not-launch")

def test_no_cross_origin_permission_for_untrusted_origin():
    response=client.options("/v1/catalog",headers={"Origin":"https://untrusted.example","Access-Control-Request-Method":"GET"})
    assert "access-control-allow-origin" not in response.headers
