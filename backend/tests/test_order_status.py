import pytest

from app.models import OrderStatus
from app.order_status import owner_can_move

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
