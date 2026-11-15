import pytest
from sqlalchemy import event

from app import seed
from app.models import Order, OrderItem, OrderStatus, Review
from tests.test_owner_orders_api import place, stamp

PASSWORD = "seed-pass-1234"


@pytest.fixture
def statements(db_session):
    engine = db_session.get_bind()
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    yield captured
    event.remove(engine, "before_cursor_execute", record)


def add_reviews(client, db_session, how_many: int) -> int:
    first_dish = 0
    for _ in range(how_many):
        order_id = place(client, db_session, lines=3)
        stamp(db_session, order_id, status=OrderStatus.DELIVERED)
        order = db_session.get(Order, order_id)
        db_session.add(
            Review(
                order_id=order_id,
                customer_id=order.customer_id,
                restaurant_id=order.restaurant_id,
                rating=4,
            )
        )
        db_session.commit()
        first_dish = db_session.query(OrderItem).filter_by(order_id=order_id).first().menu_item_id
    return first_dish


def count(client, statements, path: str) -> int:
    statements.clear()
    response = client.get(path, params={"page_size": 50})
    assert response.status_code == 200
    return len(statements)


@pytest.mark.parametrize("route", ["/restaurants/1/reviews", "/menu-items/{dish}/reviews"])
def test_statement_count_is_constant_as_reviews_grow(client, db_session, statements, route):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    dish = add_reviews(client, db_session, 2)
    path = route.format(dish=dish)
    small = count(client, statements, path)
    small_items = len(client.get(path, params={"page_size": 50}).json()["items"])

    dish = add_reviews(client, db_session, 18)
    large = count(client, statements, path)
    large_items = len(client.get(path, params={"page_size": 50}).json()["items"])

    assert (small_items, large_items) == (2, 20)
    assert small == large
    assert large <= 7
