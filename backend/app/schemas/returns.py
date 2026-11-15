from typing import Annotated

from pydantic import ConfigDict, StringConstraints

from app.schemas.request import RequestModel

ReturnReason = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)
]


class ReturnRequestCreate(RequestModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReturnReason
