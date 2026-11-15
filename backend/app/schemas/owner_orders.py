from pydantic import BaseModel, ConfigDict, field_validator

from app.models import OrderStatus
from app.schemas.orders import OrderCore

KITCHEN_STEPS = {OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY}


class OrderCustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str


class OwnerOrderOut(OrderCore):
    customer: OrderCustomerOut


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatus

    @field_validator("status")
    @classmethod
    def only_kitchen_steps(cls, value: OrderStatus) -> OrderStatus:
        if value not in KITCHEN_STEPS:
            raise ValueError("The status must be ACCEPTED, PREPARING or READY.")
        return value
