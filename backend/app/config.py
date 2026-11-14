from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    database_url: str
    jwt_secret: Annotated[str, Field(min_length=32)]
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_expire_minutes: int = 60
    openai_api_key: str = ""
    openai_model: str = ""
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    reminder_stale_minutes: int = 15

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
