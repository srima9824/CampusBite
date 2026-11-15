from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models import OrderStatus
from app.schemas.orders import OrderCore


class OrderCustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str


class OwnerOrderOut(OrderCore):
    customer: OrderCustomerOut


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal[OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY]
