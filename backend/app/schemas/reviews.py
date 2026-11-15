from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: Annotated[int, Field(ge=1, le=5)]
    comment: Annotated[str | None, Field(max_length=500)] = None

    @field_validator("comment")
    @classmethod
    def blank_comment_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rating: int
    comment: str | None
    created_at: datetime
