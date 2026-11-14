from datetime import UTC, datetime, timedelta

import jwt
import pytest
from pydantic import ValidationError

from app.config import get_settings
from app.models import Role, User
from app.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def make_user(role: Role = Role.CUSTOMER) -> User:
    return User(id=7, name="Asha", email="asha@masaischool.ac.in", password_hash="x", role=role)


def test_hash_is_not_plain_and_verifies():
    hashed = hash_password("correct-horse")

    assert hashed != "correct-horse"
    assert hashed.startswith("$2")
    assert verify_password("correct-horse", hashed)


def test_hash_is_salted():
    assert hash_password("correct-horse") != hash_password("correct-horse")


def test_wrong_password_fails():
    assert not verify_password("wrong-horse", hash_password("correct-horse"))


@pytest.mark.parametrize("role", list(Role))
def test_token_decodes_to_sub_and_role(role):
    token = create_access_token(make_user(role))

    claims = decode_access_token(token)

    assert claims["sub"] == "7"
    assert claims["role"] == role.value


def encode(claims: dict, secret: str | None = None) -> str:
    settings = get_settings()
    return jwt.encode(claims, secret or settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_expired_token_rejected():
    past = datetime.now(UTC) - timedelta(minutes=5)
    token = encode({"sub": "7", "role": "customer", "exp": past})

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_tampered_token_rejected():
    header, payload, signature = create_access_token(make_user()).split(".")
    forged = jwt.utils.base64url_encode(b'{"sub":"1","role":"restaurant_owner","exp":9999999999}')

    with pytest.raises(InvalidTokenError):
        decode_access_token(f"{header}.{forged.decode()}.{signature}")


def test_token_signed_with_other_secret_rejected():
    future = datetime.now(UTC) + timedelta(minutes=5)
    token = encode({"sub": "7", "exp": future}, secret="another-secret-that-is-long-enough")

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_token_without_expiry_rejected():
    with pytest.raises(InvalidTokenError):
        decode_access_token(encode({"sub": "7"}))


@pytest.mark.parametrize("secret", ["", "change-me", "x" * 31])
def test_short_or_empty_secret_is_refused_at_startup(monkeypatch, secret):
    monkeypatch.setenv("JWT_SECRET", secret)
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        get_settings()


def test_secret_of_32_characters_is_accepted(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    get_settings.cache_clear()

    assert create_access_token(make_user())


def test_only_hs256_is_allowed(monkeypatch):
    monkeypatch.setenv("JWT_ALGORITHM", "none")
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        get_settings()
