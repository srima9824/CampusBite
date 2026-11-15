from app.models import OrderStatus

OWNER_NEXT_STATUS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.PLACED: OrderStatus.ACCEPTED,
    OrderStatus.ACCEPTED: OrderStatus.PREPARING,
    OrderStatus.PREPARING: OrderStatus.READY,
}


def owner_can_move(current: OrderStatus, target: OrderStatus) -> bool:
    return OWNER_NEXT_STATUS.get(current) is target

DELIVERY_NEXT_STATUS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.ASSIGNED: OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.OUT_FOR_DELIVERY: OrderStatus.DELIVERED,
}


def delivery_partner_can_move(current: OrderStatus, target: OrderStatus) -> bool:
    return DELIVERY_NEXT_STATUS.get(current) is target
