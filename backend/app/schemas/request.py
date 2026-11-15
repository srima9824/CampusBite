from typing import Any

from pydantic import BaseModel, model_validator

NUL = "\x00"


def contains_nul(value: Any) -> bool:
    if isinstance(value, str):
        return NUL in value
    if isinstance(value, dict):
        return any(contains_nul(item) for item in value.values())
    if isinstance(value, list):
        return any(contains_nul(item) for item in value)
    return False


class RequestModel(BaseModel):
    """Base for every request body. PostgreSQL cannot store NUL characters, so they are refused
    here with a 422 instead of failing later with a 500."""

    @model_validator(mode="before")
    @classmethod
    def refuse_nul_characters(cls, data: Any) -> Any:
        if contains_nul(data):
            raise ValueError("Text cannot contain NUL characters.")
        return data
