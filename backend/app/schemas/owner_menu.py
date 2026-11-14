from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

DishName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
DishCategory = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
DishDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
DishPrice = Annotated[int, Field(ge=1, le=100_000)]


class MenuItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: DishName
    description: DishDescription = ""
    category: DishCategory
    price: DishPrice
    is_veg: bool


class MenuItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: DishName | None = None
    description: DishDescription | None = None
    category: DishCategory | None = None
    price: DishPrice | None = None
    is_veg: bool | None = None

    @model_validator(mode="after")
    def require_a_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Send at least one field to change.")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Fields that are sent cannot be null.")
        return self


class AvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_available: bool
