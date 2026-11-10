"""Optional assistance boundary. No model call or customer persistence exists yet."""
from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field
from services.common.runtime import ProblemResponse, create_app, unavailable

app = create_app("assistant")

class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=2000)

@app.post("/v1/assist", response_model=ProblemResponse, status_code=503, tags=["not implemented"])
def assist(body: AssistantRequest, request: Request):
    # Never echo/store user input or make external calls from a disabled scaffold.
    return unavailable(request, "ASSISTANT_DISABLED")
