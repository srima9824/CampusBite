from datetime import datetime

from pydantic import BaseModel


class PublicReviewOut(BaseModel):
    rating: int
    comment: str | None
    created_at: datetime
    reviewer: str
    dishes: list[str]
