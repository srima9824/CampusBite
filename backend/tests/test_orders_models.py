import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import seed
from app.models import MenuItem, Order, OrderItem, OrderStatus, PaymentLedger, PaymentStatus, User

PASSWORD = "seed-pass-1234"


def test_order_status_has_the_nine_lifecycle_statuses_in_order():
    assert [s.name for s in OrderStatus] == [
        "PLACED",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "ASSIGNED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
    ]


def test_payment_status_values():
    assert [s.value for s in PaymentStatus] == ["mock_paid", "refunded"]


@pytest.fixture
def order(db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    dish = db_session.scalar(select(MenuItem).order_by(MenuItem.id))
    customer = db_session.scalar(select(User).where(User.email == "maya@masaischool.ac.in"))
    order = Order(
        customer_id=customer.id,
        restaurant_id=dish.restaurant_id,
        total=dish.price,
        delivery_address="Hostel 4",
    )
    db_session.add(order)
    db_session.commit()
    order.dish = dish
    return order


def test_order_defaults(order):
    assert order.status is OrderStatus.PLACED
    assert order.payment_status is PaymentStatus.MOCK_PAID
    assert order.created_at is not None
    assert order.notes is None


def item(order, **overrides) -> OrderItem:
    values = {
        "order_id": order.id,
        "menu_item_id": order.dish.id,
        "name": "n",
        "unit_price": 10,
        "quantity": 1,
        "line_total": 10,
    }
    return OrderItem(**{**values, **overrides})


@pytest.mark.parametrize(
    "build",
    [
        lambda o: item(o, quantity=0),
        lambda o: item(o, quantity=21),
        lambda o: item(o, unit_price=0),
        lambda o: item(o, unit_price=-1),
        lambda o: item(o, line_total=-5),
        lambda o: PaymentLedger(
            order_id=o.id, amount=0, method="mock", status=PaymentStatus.MOCK_PAID
        ),
        lambda o: PaymentLedger(
            order_id=o.id, amount=-10, method="mock", status=PaymentStatus.MOCK_PAID
        ),
    ],
    ids=[
        "quantity_0",
        "quantity_21",
        "unit_price_0",
        "unit_price_negative",
        "line_total_negative",
        "amount_0",
        "amount_negative",
    ],
)
def test_check_constraints_reject_bad_rows(db_session, order, build):
    db_session.add(build(order))

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize("quantity", [1, 20])
def test_quantity_bounds_are_accepted(db_session, order, quantity):
    db_session.add(item(order, quantity=quantity))

    db_session.commit()


@pytest.mark.parametrize("total", [0, -1])
def test_order_total_must_be_positive(db_session, order, total):
    db_session.add(
        Order(
            customer_id=order.customer_id,
            restaurant_id=order.restaurant_id,
            total=total,
            delivery_address="Hostel 4",
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
