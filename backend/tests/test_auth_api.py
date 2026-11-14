import logging
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import User

PASSWORD = "s3cret-pass-word"
EMAIL = "Asha@MasaiSchool.ac.in"


def register(client, **overrides):
    body = {"name": "Asha", "email": EMAIL, "password": PASSWORD, **overrides}
    return client.post("/auth/register", json=body)


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_register_returns_token_and_customer(client):
    response = register(client)

    body = response.json()
    assert response.status_code == 201
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "customer"
    assert body["user"]["email"] == "asha@masaischool.ac.in"
    assert body["user"]["name"] == "Asha"


def test_register_never_returns_password(client):
    response = register(client)

    assert PASSWORD not in response.text
    assert "password" not in response.text


def test_register_stores_bcrypt_hash(client, db_session):
    register(client)

    stored = db_session.scalar(select(User)).password_hash
    assert stored != PASSWORD
    assert stored.startswith("$2")


@pytest.mark.parametrize("role", ["restaurant_owner", "delivery_partner", "admin"])
def test_register_ignores_requested_role(client, role):
    response = register(client, role=role)

    assert response.status_code == 201
    assert response.json()["user"]["role"] == "customer"


@pytest.mark.parametrize(
    "second_email", [EMAIL, "asha@masaischool.ac.in", "ASHA@MASAISCHOOL.AC.IN"]
)
def test_duplicate_email_conflicts(client, second_email):
    register(client)

    response = register(client, email=second_email)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "email_taken"


BAD_EMAILS = [
    "a@gmail.com",
    "a@evilmasaischool.ac.in",
    "a@@masaischool.ac.in",
    "a@mail.masaischool.ac.in",
    "a@masaischool.ac.in.evil.com",
    "masaischool.ac.in",
    "",
]


@pytest.mark.parametrize("email", BAD_EMAILS)
def test_register_rejects_bad_email(client, email):
    assert register(client, email=email).status_code == 422


@pytest.mark.parametrize("email", BAD_EMAILS)
def test_login_rejects_bad_email(client, email):
    response = client.post("/auth/login", json={"email": email, "password": PASSWORD})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [
        {"password": "short"},
        {"password": "a" * 73},
        {"password": "é" * 37},
        {"name": ""},
        {"name": "   "},
    ],
    ids=["short-password", "73-bytes", "74-bytes-multibyte", "empty-name", "blank-name"],
)
def test_register_rejects_invalid_fields(client, overrides):
    assert register(client, **overrides).status_code == 422


def test_register_accepts_72_byte_password(client):
    assert register(client, password="a" * 72).status_code == 201


def test_login_rejects_over_72_byte_password(client):
    register(client)

    response = client.post("/auth/login", json={"email": EMAIL, "password": "a" * 73})

    assert response.status_code == 422


def test_login_returns_token_usable_on_me(client):
    register(client)

    response = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    me = client.get("/auth/me", headers=bearer(response.json()["access_token"]))

    assert response.status_code == 200
    assert me.status_code == 200
    assert me.json()["email"] == "asha@masaischool.ac.in"
    assert me.json()["role"] == "customer"


def test_wrong_password_and_unknown_email_look_identical(client):
    register(client)

    wrong_password = client.post("/auth/login", json={"email": EMAIL, "password": "wrong-password"})
    unknown_email = client.post(
        "/auth/login", json={"email": "nobody@masaischool.ac.in", "password": PASSWORD}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["detail"]["code"] == "invalid_credentials"


def expired_token(sub: str) -> str:
    settings = get_settings()
    claims = {"sub": sub, "exp": datetime.now(UTC) - timedelta(minutes=1)}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.mark.parametrize(
    "kind", ["no-token", "garbage", "expired", "deleted-user", "non-numeric-sub"]
)
def test_me_rejects_unauthenticated(client, db_session, kind):
    token = register(client).json()["access_token"]
    user = db_session.scalar(select(User))
    headers = {
        "no-token": {},
        "garbage": bearer("not.a.token"),
        "expired": bearer(expired_token(str(user.id))),
        "deleted-user": bearer(token),
        "non-numeric-sub": bearer(
            jwt.encode(
                {"sub": "abc", "exp": datetime.now(UTC) + timedelta(minutes=5)},
                get_settings().jwt_secret,
                algorithm=get_settings().jwt_algorithm,
            )
        ),
    }[kind]
    if kind == "deleted-user":
        db_session.delete(user)
        db_session.commit()

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["detail"]["code"] == "not_authenticated"


def test_sensitive_values_are_never_logged(client, caplog):
    caplog.set_level(logging.DEBUG)

    token = register(client).json()["access_token"]
    login_token = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()[
        "access_token"
    ]
    client.get("/auth/me", headers=bearer(token))
    client.post("/auth/login", json={"email": EMAIL, "password": "wrong-password"})

    for secret in (PASSWORD, "wrong-password", token, login_token):
        assert secret not in caplog.text
