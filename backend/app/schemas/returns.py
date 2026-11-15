from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

ReturnReason = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)
]


class ReturnRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReturnReason
