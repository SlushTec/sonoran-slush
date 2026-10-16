"""Reference catalog and opt-in local workflows. Production remains disabled."""
import json
from pathlib import Path
from fastapi import HTTPException, Query, Request
from services.common.runtime import ProblemResponse, create_app, unavailable
from services.commerce.app.models import ReferenceCatalog, ReferenceProduct

ROOT = Path(__file__).resolve().parents[3]
REFERENCE = ReferenceCatalog.model_validate(json.loads((ROOT / "packages/contracts/catalog.reference.json").read_text()))
app = create_app("commerce")
from services.commerce.app.workflows import router as workflow_router
app.include_router(workflow_router)
from services.commerce.app.payments import router as payment_router
app.include_router(payment_router)

@app.get("/v1/catalog", response_model=ReferenceCatalog, tags=["reference"])
def catalog():
    return REFERENCE

@app.get("/v1/products", response_model=list[ReferenceProduct], tags=["reference"])
def products(category: str | None = Query(None, max_length=80), q: str = Query("", max_length=100)):
    return [p for p in REFERENCE.products if (not category or p.category == category) and q.strip().casefold() in p.name.casefold()]

@app.get("/v1/products/{slug}", response_model=ReferenceProduct, tags=["reference"])
def product(slug: str):
    for item in REFERENCE.products:
        if item.slug == slug:
            return item
    raise HTTPException(status_code=404, detail="Reference product not found")

async def pending_capability(request: Request):
    return unavailable(request)

for route, method in [
    ("/v1/cart", "POST"),
    ("/v1/uploads", "POST"),
]:
    app.add_api_route(route, pending_capability, methods=[method], status_code=503,
                      response_model=ProblemResponse, tags=["not implemented"],
                      name=method.lower()+"_"+route.replace("/", "_").replace("{", "").replace("}", ""))
