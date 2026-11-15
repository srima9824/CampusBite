from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import OrderStatus, ReturnStatus
from app.schemas.orders import OrderCore

KITCHEN_STEPS = {OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY}


class OrderCustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str


class DeliveryPartnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class OwnerOrderOut(OrderCore):
    customer: OrderCustomerOut
    delivery_partner: DeliveryPartnerOut | None


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatus

    @field_validator("status")
    @classmethod
    def only_kitchen_steps(cls, value: OrderStatus) -> OrderStatus:
        if value not in KITCHEN_STEPS:
            raise ValueError("The status must be ACCEPTED, PREPARING or READY.")
        return value


class AssignDeliveryPartner(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delivery_partner_id: int = Field(ge=1)


class ReturnDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["APPROVED", "REJECTED"]

    @property
    def status(self) -> ReturnStatus:
        return ReturnStatus(self.decision)
