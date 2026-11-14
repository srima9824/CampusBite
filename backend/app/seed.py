import os
import sys
from dataclasses import asdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import MenuItem, Restaurant, Role, User
from app.security import hash_password
from app.seed_data import RESTAURANTS, RestaurantSeed

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


def seed_dishes(db: Session, restaurant: Restaurant, seed: RestaurantSeed) -> int:
    existing = set(db.scalars(select(MenuItem.name).where(MenuItem.restaurant_id == restaurant.id)))
    created = 0
    for dish in seed.dishes:
        if dish.name in existing:
            continue
        db.add(MenuItem(restaurant_id=restaurant.id, **asdict(dish)))
        created += 1
    return created


def seed_restaurants(db: Session) -> tuple[int, int]:
    """Returns (restaurants created, dishes created). Needs the owner users to exist."""
    restaurants_created = dishes_created = 0
    for seed in RESTAURANTS:
        restaurant = db.scalar(select(Restaurant).where(Restaurant.name == seed.name))
        if restaurant is None:
            owner_id = db.scalar(select(User.id).where(User.email == seed.owner_email))
            if owner_id is None:
                raise LookupError(f"Owner {seed.owner_email} is missing; seed users first.")
            restaurant = Restaurant(
                owner_id=owner_id,
                name=seed.name,
                cuisine=seed.cuisine,
                description=seed.description,
                logo_key=seed.logo_key,
                image_key=seed.image_key,
            )
            db.add(restaurant)
            db.flush()
            restaurants_created += 1
        dishes_created += seed_dishes(db, restaurant, seed)
    db.commit()
    return restaurants_created, dishes_created


def main() -> int:
    password = os.environ.get("SEED_PASSWORD", "")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Set SEED_PASSWORD to at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        created = seed_users(db, password)
        restaurants_created, dishes_created = seed_restaurants(db)
    print(f"Created {created} test accounts, skipped {len(TEST_ACCOUNTS) - created}.")
    print(f"Created {restaurants_created} restaurants and {dishes_created} dishes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
