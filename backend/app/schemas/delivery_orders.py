from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models import OrderStatus
from app.schemas.orders import OrderRestaurantOut
from app.schemas.owner_orders import OrderCustomerOut

DELIVERY_STEPS = {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED}


class DeliveryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    quantity: int


class DeliveryOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    delivery_address: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    restaurant: OrderRestaurantOut
    customer: OrderCustomerOut
    items: list[DeliveryItemOut]


class DeliveryStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatus

    @field_validator("status")
    @classmethod
    def only_delivery_steps(cls, value: OrderStatus) -> OrderStatus:
        if value not in DELIVERY_STEPS:
            raise ValueError("The status must be OUT_FOR_DELIVERY or DELIVERED.")
        return value
