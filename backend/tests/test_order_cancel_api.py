from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import seed
from app.main import app
from app.models import MenuItem, Order, OrderStatus, PaymentLedger, PaymentStatus, User
from app.security import create_access_token

PASSWORD = "seed-pass-1234"

IN_PROGRESS = "This order is already being prepared, so it can no longer be cancelled."

BLOCKED = [
    (OrderStatus.ACCEPTED, IN_PROGRESS),
    (OrderStatus.PREPARING, IN_PROGRESS),
    (OrderStatus.READY, IN_PROGRESS),
    (OrderStatus.ASSIGNED, IN_PROGRESS),
    (OrderStatus.OUT_FOR_DELIVERY, IN_PROGRESS),
    (OrderStatus.DELIVERED, "Delivered orders cannot be cancelled."),
    (OrderStatus.CANCELLED, "This order is already cancelled."),
    (OrderStatus.REFUNDED, "This order has already been refunded."),
]


@pytest.fixture
def seeded(client, db_session):
    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)
    return client


def auth(db_session, local_part: str = "maya") -> dict:
    user = db_session.scalar(select(User).where(User.email == f"{local_part}@masaischool.ac.in"))
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def place(client, db_session, who: str = "maya") -> int:
    dish = db_session.scalar(select(MenuItem).order_by(MenuItem.id))
    payload = {
        "items": [{"menu_item_id": dish.id, "quantity": 2}],
        "delivery_address": "Hostel 4",
    }
    response = client.post("/orders", json=payload, headers=auth(db_session, who))
    assert response.status_code == 201
    return response.json()["id"]


def cancel(client, db_session, order_id, who: str = "maya"):
    return client.post(f"/orders/{order_id}/cancel", headers=auth(db_session, who))


def set_status(db_session, order_id: int, status: OrderStatus) -> None:
    db_session.get(Order, order_id).status = status
    db_session.commit()


def ledger_rows(db_session, order_id: int) -> list[PaymentLedger]:
    return list(
        db_session.scalars(
            select(PaymentLedger)
            .where(PaymentLedger.order_id == order_id)
            .order_by(PaymentLedger.id)
        )
    )


def snapshot(db_session, order_id: int):
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    rows = [(r.status, r.amount) for r in ledger_rows(db_session, order_id)]
    return order.status, order.payment_status, rows


def test_cancel_returns_cancelled_order_with_refunded_payment(seeded, db_session):
    order_id = place(seeded, db_session)
    order = db_session.get(Order, order_id)
    order.updated_at = datetime.now(UTC) - timedelta(days=1)
    db_session.commit()
    before = seeded.get(f"/orders/{order_id}", headers=auth(db_session)).json()

    response = cancel(seeded, db_session, order_id)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == order_id
    assert data["status"] == "CANCELLED"
    assert data["payment"] == {"method": "mock", "status": "refunded"}
    assert data["total"] == before["total"]
    assert datetime.fromisoformat(data["updated_at"]) > datetime.fromisoformat(before["updated_at"])


def test_cancel_writes_refund_ledger_row_after_payment_row(seeded, db_session):
    order_id = place(seeded, db_session)
    total = db_session.get(Order, order_id).total

    cancel(seeded, db_session, order_id)

    db_session.expire_all()
    order = db_session.get(Order, order_id)
    rows = ledger_rows(db_session, order_id)
    assert order.status is OrderStatus.CANCELLED
    assert order.payment_status is PaymentStatus.REFUNDED
    assert [r.status for r in rows] == [PaymentStatus.MOCK_PAID, PaymentStatus.REFUNDED]
    assert [r.amount for r in rows] == [total, total]
    assert {r.method for r in rows} == {"mock"}


def test_cancelled_order_is_listed_as_cancelled_not_placed(seeded, db_session):
    order_id = place(seeded, db_session)
    cancel(seeded, db_session, order_id)
    headers = auth(db_session)

    cancelled = seeded.get("/orders?status=CANCELLED", headers=headers).json()
    placed = seeded.get("/orders?status=PLACED", headers=headers).json()

    assert [i["id"] for i in cancelled["items"]] == [order_id]
    assert placed["items"] == []


def test_get_order_reflects_cancellation(seeded, db_session):
    order_id = place(seeded, db_session)
    cancelled = cancel(seeded, db_session, order_id)

    fetched = seeded.get(f"/orders/{order_id}", headers=auth(db_session))

    assert fetched.status_code == 200
    assert fetched.json() == cancelled.json()


@pytest.mark.parametrize(("status", "message"), BLOCKED, ids=[s.value for s, _ in BLOCKED])
def test_non_placed_order_is_409_and_unchanged(seeded, db_session, status, message):
    order_id = place(seeded, db_session)
    set_status(db_session, order_id, status)
    before = snapshot(db_session, order_id)

    response = cancel(seeded, db_session, order_id)

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "invalid_transition", "message": message}
    assert snapshot(db_session, order_id) == before


def test_cancelling_twice_conflicts_and_keeps_one_refund(seeded, db_session):
    order_id = place(seeded, db_session)
    first = cancel(seeded, db_session, order_id)

    second = cancel(seeded, db_session, order_id)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"]["message"] == "This order is already cancelled."
    refunds = [r for r in ledger_rows(db_session, order_id) if r.status is PaymentStatus.REFUNDED]
    assert len(refunds) == 1


def test_cancelled_order_stays_final_after_listing(seeded, db_session):
    order_id = place(seeded, db_session)
    cancel(seeded, db_session, order_id)
    seeded.get("/orders?status=CANCELLED", headers=auth(db_session))

    again = cancel(seeded, db_session, order_id)

    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "invalid_transition"
    assert len(ledger_rows(db_session, order_id)) == 2


def test_cancel_leaves_other_orders_untouched(seeded, db_session):
    target = place(seeded, db_session)
    other = place(seeded, db_session)
    other_before = snapshot(db_session, other)

    cancel(seeded, db_session, target)

    assert snapshot(db_session, other) == other_before
    assert snapshot(db_session, other)[0] is OrderStatus.PLACED


@pytest.mark.parametrize("order_id", [99999, 0])
def test_unknown_order_is_404(seeded, db_session, order_id):
    response = cancel(seeded, db_session, order_id)

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "order_not_found"


def test_non_integer_id_is_422(seeded, db_session):
    response = seeded.post("/orders/abc/cancel", headers=auth(db_session))

    assert response.status_code == 422


def test_failed_ledger_insert_rolls_back_cancellation(seeded, db_session, monkeypatch):
    order_id = place(seeded, db_session)
    before = snapshot(db_session, order_id)
    original = PaymentLedger

    def broken_ledger(**_):
        raise RuntimeError("ledger down")

    monkeypatch.setattr("app.services.orders.PaymentLedger", broken_ledger)
    response = TestClient(app, raise_server_exceptions=False).post(
        f"/orders/{order_id}/cancel", headers=auth(db_session)
    )
    monkeypatch.undo()
    db_session.rollback()  # the real get_db closes (rolls back) its session on error

    assert original is PaymentLedger
    assert response.status_code == 500
    assert snapshot(db_session, order_id) == before
    assert before[0] is OrderStatus.PLACED
    assert before[1] is PaymentStatus.MOCK_PAID
    assert len(before[2]) == 1


def test_failed_commit_rolls_back_cancellation(seeded, db_session, monkeypatch):
    order_id = place(seeded, db_session)
    before = snapshot(db_session, order_id)
    headers = auth(db_session)

    def broken_commit():
        raise RuntimeError("commit failed")

    monkeypatch.setattr(db_session, "commit", broken_commit)
    response = TestClient(app, raise_server_exceptions=False).post(
        f"/orders/{order_id}/cancel", headers=headers
    )
    monkeypatch.undo()
    db_session.rollback()

    assert response.status_code == 500
    assert snapshot(db_session, order_id) == before
    assert len(before[2]) == 1
