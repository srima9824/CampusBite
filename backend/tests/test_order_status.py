import pytest

from app.models import OrderStatus
from app.order_status import delivery_partner_can_move, owner_can_move

OWNER_TARGETS = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY]
ALLOWED = {
    (OrderStatus.PLACED, OrderStatus.ACCEPTED),
    (OrderStatus.ACCEPTED, OrderStatus.PREPARING),
    (OrderStatus.PREPARING, OrderStatus.READY),
}


@pytest.mark.parametrize("target", OWNER_TARGETS)
@pytest.mark.parametrize("current", list(OrderStatus))
def test_owner_can_move_only_one_step_forward(current, target):
    assert owner_can_move(current, target) is ((current, target) in ALLOWED)


DELIVERY_ALLOWED = {
    (OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY),
    (OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED),
}


@pytest.mark.parametrize("target", list(OrderStatus))
@pytest.mark.parametrize("current", list(OrderStatus))
def test_delivery_partner_can_move_only_one_step_forward(current, target):
    assert delivery_partner_can_move(current, target) is ((current, target) in DELIVERY_ALLOWED)
