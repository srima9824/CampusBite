from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.errors import api_error
from app.models import Role, User
from app.schemas.orders import OrderCreate, OrderOut
from app.services import orders as service

router = APIRouter(prefix="/orders", tags=["orders"])

DbSession = Annotated[Session, Depends(get_db)]
Customer = Annotated[User, Depends(require_roles(Role.CUSTOMER))]


@router.post("", status_code=status.HTTP_201_CREATED)
def place_order(data: OrderCreate, customer: Customer, db: DbSession) -> OrderOut:
    try:
        order = service.place_order(db, customer, data)
    except service.OrderRejected as rejection:
        raise api_error(rejection.status_code, rejection.code, rejection.message) from None
    return OrderOut.model_validate(order)


@router.get("/{order_id}")
def get_order(order_id: int, customer: Customer, db: DbSession) -> OrderOut:
    order = service.get_order_for_customer(db, customer, order_id)
    if order is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "order_not_found", "Order not found.")
    return OrderOut.model_validate(order)
