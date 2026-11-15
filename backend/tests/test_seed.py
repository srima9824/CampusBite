import re

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app import seed
from app.models import Role, User
from app.security import hash_password, verify_password

PASSWORD = "seed-pass-1234"

EXPECTED_EMAILS = {
    Role.CUSTOMER: {"maya@masaischool.ac.in", "leo@masaischool.ac.in"},
    Role.RESTAURANT_OWNER: {
        "owner1@masaischool.ac.in",
        "owner3@masaischool.ac.in",
        "owner5@masaischool.ac.in",
        "owner7@masaischool.ac.in",
    },
    Role.DELIVERY_PARTNER: {
        "sam@masaischool.ac.in",
        "priya@masaischool.ac.in",
        "jonah@masaischool.ac.in",
    },
}


def count_users(db) -> int:
    return db.scalar(select(func.count()).select_from(User))


def test_seed_creates_nine_users_with_expected_roles_and_emails(db_session):
    created = seed.seed_users(db_session, PASSWORD)

    assert created == 9
    assert count_users(db_session) == 9
    for role, emails in EXPECTED_EMAILS.items():
        stored = set(db_session.scalars(select(User.email).where(User.role == role)))
        assert stored == emails


def test_seed_emails_follow_domain_rule(db_session):
    seed.seed_users(db_session, PASSWORD)

    for email in db_session.scalars(select(User.email)):
        assert re.fullmatch(r"[^\s@]+@masaischool\.ac\.in", email)


def test_seed_stores_bcrypt_hashes_that_verify(db_session):
    seed.seed_users(db_session, PASSWORD)

    for user in db_session.scalars(select(User)):
        assert user.password_hash != PASSWORD
        assert user.password_hash.startswith("$2")
        assert verify_password(PASSWORD, user.password_hash)


@pytest.mark.parametrize(
    ("email", "role"),
    [
        ("maya@masaischool.ac.in", "customer"),
        ("owner3@masaischool.ac.in", "restaurant_owner"),
        ("jonah@masaischool.ac.in", "delivery_partner"),
    ],
)
def test_seeded_user_can_log_in(client, db_session, email, role):
    seed.seed_users(db_session, PASSWORD)

    login = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    token = login.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert login.status_code == 200
    assert me.status_code == 200
    assert me.json()["role"] == role
    assert me.json()["email"] == email


def test_seed_is_idempotent(db_session):
    assert seed.seed_users(db_session, PASSWORD) == 9

    assert seed.seed_users(db_session, PASSWORD) == 0
    assert count_users(db_session) == 9


def test_seed_keeps_existing_user_unchanged(db_session):
    existing_hash = hash_password("other-password-1")
    db_session.add(
        User(
            name="Original Maya",
            email="maya@masaischool.ac.in",
            password_hash=existing_hash,
            role=Role.CUSTOMER,
        )
    )
    db_session.commit()

    created = seed.seed_users(db_session, PASSWORD)

    maya = db_session.scalar(select(User).where(User.email == "maya@masaischool.ac.in"))
    assert created == 8
    assert count_users(db_session) == 9
    assert maya.password_hash == existing_hash
    assert maya.name == "Original Maya"


@pytest.fixture
def seed_session_factory(db_session, monkeypatch):
    factory = sessionmaker(bind=db_session.get_bind(), expire_on_commit=False)
    monkeypatch.setattr(seed, "SessionLocal", factory)
    return factory


@pytest.mark.parametrize("password", [None, "", "short"])
def test_main_rejects_missing_or_short_password(
    password, seed_session_factory, db_session, monkeypatch, capsys
):
    if password is None:
        monkeypatch.delenv("SEED_PASSWORD", raising=False)
    else:
        monkeypatch.setenv("SEED_PASSWORD", password)

    assert seed.main() == 1

    captured = capsys.readouterr()
    assert "SEED_PASSWORD" in captured.err
    assert captured.out == ""
    assert count_users(db_session) == 0


def test_main_seeds_and_reports_created_count(
    seed_session_factory, db_session, monkeypatch, capsys
):
    monkeypatch.setenv("SEED_PASSWORD", PASSWORD)

    assert seed.main() == 0

    assert "Created 9" in capsys.readouterr().out
    assert count_users(db_session) == 9


def test_sample_orders_give_the_test_customers_history_and_are_idempotent(db_session):
    from app.models import Order, OrderStatus, PaymentStatus, Review

    seed.seed_users(db_session, PASSWORD)
    seed.seed_restaurants(db_session)

    created = seed.seed_sample_orders(db_session)
    again = seed.seed_sample_orders(db_session)

    orders = list(db_session.scalars(select(Order)))
    assert created == len(seed.SAMPLE_ORDERS) == len(orders)
    assert again == 0
    delivered = [o for o in orders if o.status is OrderStatus.DELIVERED]
    assert all(o.delivery_partner_id is not None for o in delivered)
    cancelled = [o for o in orders if o.status is OrderStatus.CANCELLED]
    assert [o.payment_status for o in cancelled] == [PaymentStatus.REFUNDED]
    assert db_session.scalar(select(func.count()).select_from(Review)) == len(delivered)
