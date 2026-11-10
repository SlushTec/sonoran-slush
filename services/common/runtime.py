"""Shared process boundary; no cloud credentials or application data are loaded."""
import os
from uuid import uuid4
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

class Problem(BaseModel):
    code: str
    message: str
    retryable: bool = False

class ProblemResponse(BaseModel):
    error: Problem
    request_id: str

class HealthResponse(BaseModel):
    service: str
    status: str = "scaffold"
    live_integrations: bool = False

class ReadinessResponse(BaseModel):
    ready: bool = False
    reason: str = "Production integrations and release gates are incomplete."

def unavailable(request: Request, code: str = "NOT_IMPLEMENTED") -> JSONResponse:
    problem = ProblemResponse(error=Problem(code=code, message="This capability is not implemented or enabled in the foundation."), request_id=request.state.request_id)
    return JSONResponse(status_code=503, content=problem.model_dump())

def create_app(name: str) -> FastAPI:
    if os.environ.get("SONORAN_STAGE", "scaffold") != "scaffold":
        raise RuntimeError("This scaffold must not run as a production commerce service.")
    app = FastAPI(title=f"Sonoran Slush {name}", version="0.1.0", description="Read-only development foundation. No live commerce or customer data.")
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.environ.get("SONORAN_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3137").split(",") if o.strip()], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])

    @app.exception_handler(HTTPException)
    async def http_problem(request: Request, exc: HTTPException):
        codes = {503: "NOT_IMPLEMENTED", 401: "ACCESS_REQUIRED", 404: "NOT_FOUND", 409: "VERSION_CONFLICT", 422: "VALIDATION_ERROR"}
        return JSONResponse(status_code=exc.status_code, content=ProblemResponse(
            error=Problem(code=codes.get(exc.status_code, "REQUEST_FAILED"), message=str(exc.detail)),
            request_id=getattr(request.state, "request_id", str(uuid4()))).model_dump())

    @app.exception_handler(RequestValidationError)
    async def validation_problem(request: Request, exc: RequestValidationError):
        # Pydantic's default error includes the rejected input. Never echo private
        # inscriptions, contact details, or credentials in an error response.
        fields = [".".join(str(p) for p in error["loc"] if p != "body") for error in exc.errors()[:4]]
        return JSONResponse(status_code=422, content=ProblemResponse(
            error=Problem(code="VALIDATION_ERROR", message="Please check these fields: " + ", ".join(fields)),
            request_id=getattr(request.state, "request_id", str(uuid4()))).model_dump())

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health", response_model=HealthResponse, tags=["process"])
    def health():
        return HealthResponse(service=name)

    @app.get("/ready", response_model=ReadinessResponse, responses={503:{"model":ReadinessResponse}}, tags=["process"])
    def ready():
        return JSONResponse(status_code=503, content=ReadinessResponse().model_dump())

    return app
