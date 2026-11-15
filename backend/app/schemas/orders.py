from datetime import datetime
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models import OrderStatus, PaymentStatus

DeliveryAddress = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=5, max_length=200)
]


class OrderLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    menu_item_id: Annotated[int, Field(ge=1)]
    quantity: Annotated[int, Field(ge=1, le=20)]


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: Annotated[list[OrderLineIn], Field(min_length=1, max_length=30)]
    delivery_address: DeliveryAddress
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None

    @field_validator("notes")
    @classmethod
    def blank_notes_become_none(cls, notes: str | None) -> str | None:
        return notes or None

    @model_validator(mode="after")
    def dishes_are_unique(self) -> Self:
        ids = [line.menu_item_id for line in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each dish can appear once; change its quantity instead.")
        return self


class OrderRestaurantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: int
    name: str
    unit_price: int
    quantity: int
    line_total: int


class PaymentOut(BaseModel):
    method: str
    status: PaymentStatus


class OrderCore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    total: int
    delivery_address: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]
    payment: PaymentOut

    @model_validator(mode="before")
    @classmethod
    def describe_payment(cls, order: object) -> object:
        if isinstance(order, dict):
            return order
        return {
            **{name: getattr(order, name) for name in cls.model_fields if name != "payment"},
            "payment": {"method": "mock", "status": order.payment_status},
        }


class OrderOut(OrderCore):
    restaurant: OrderRestaurantOut
