from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.request import RequestModel

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)]


class InsightRequest(RequestModel):
    model_config = ConfigDict(extra="forbid")

    question: Question


class InsightResponse(BaseModel):
    answer: str
    orders_considered: int
