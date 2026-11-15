from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)]


class InsightRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Question


class InsightResponse(BaseModel):
    answer: str
    orders_considered: int
