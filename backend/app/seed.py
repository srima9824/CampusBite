import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password

MIN_PASSWORD_LENGTH = 8
DOMAIN = "masaischool.ac.in"

TEST_ACCOUNTS: list[tuple[str, str, Role]] = [
    ("Maya Patel", "maya", Role.CUSTOMER),
    ("Leo Chen", "leo", Role.CUSTOMER),
    ("Owner 1", "owner1", Role.RESTAURANT_OWNER),
    ("Owner 3", "owner3", Role.RESTAURANT_OWNER),
    ("Owner 5", "owner5", Role.RESTAURANT_OWNER),
    ("Owner 7", "owner7", Role.RESTAURANT_OWNER),
    ("Sam Okafor", "sam", Role.DELIVERY_PARTNER),
    ("Priya Nair", "priya", Role.DELIVERY_PARTNER),
    ("Jonah Reyes", "jonah", Role.DELIVERY_PARTNER),
]


def seed_users(db: Session, password: str) -> int:
    existing = set(db.scalars(select(User.email)))
    password_hash = hash_password(password)
    created = 0
    for name, local_part, role in TEST_ACCOUNTS:
        email = f"{local_part}@{DOMAIN}"
        if email in existing:
            continue
        db.add(User(name=name, email=email, password_hash=password_hash, role=role))
        created += 1
    db.commit()
    return created


def main() -> int:
    password = os.environ.get("SEED_PASSWORD", "")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Set SEED_PASSWORD to at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        created = seed_users(db, password)
    print(f"Created {created} test accounts, skipped {len(TEST_ACCOUNTS) - created}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
