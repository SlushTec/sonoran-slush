from typing import Literal
from pydantic import BaseModel, ConfigDict

class Category(BaseModel):
    slug: str
    name: str
    description: str

class ReferenceProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str
    name: str
    category: str
    source_paths: list[str]
    status: Literal["reference_only"]
    price_minor: None = None
    currency: Literal["USD"] = "USD"
    purchasable: Literal[False] = False

class ServicePath(BaseModel):
    slug: str
    name: str
    source_paths: list[str]

class ReferenceCatalog(BaseModel):
    schema_version: Literal[1]
    data_classification: Literal["public_reference_fixture"]
    source_commit: str
    production_approved: Literal[False]
    categories: list[Category]
    products: list[ReferenceProduct]
    service_paths: list[ServicePath]
