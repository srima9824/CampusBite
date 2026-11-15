import os
import sys
from dataclasses import asdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import MenuItem, Order, OrderStatus, Restaurant, Review, Role, User
from app.models.restaurant import utc_now
from app.schemas.orders import OrderCreate, OrderLineIn
from app.security import hash_password
from app.seed_data import RESTAURANTS, RestaurantSeed
from app.services.orders import cancel_order, place_order

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


# (customer, restaurant, dishes, days ago, final status, rating, review comment)
SampleOrder = tuple[str, str, tuple[tuple[str, int], ...], int, OrderStatus, int | None, str | None]

SAMPLE_ORDERS: tuple[SampleOrder, ...] = (
    ("maya", "Dosa Dash", (("Masala Dosa", 2), ("Filter Coffee", 2)), 6,
     OrderStatus.DELIVERED, 5, "Crisp dosas and the coffee was perfect."),
    ("maya", "Burger Barn", (("Classic Cheeseburger", 1), ("Double Stack", 1)), 4,
     OrderStatus.DELIVERED, 4, "Juicy burgers, arrived a little late."),
    ("maya", "Dosa Dash", (("Idli Sambar", 2), ("Medu Vada", 1)), 3,
     OrderStatus.DELIVERED, 5, "Fresh and hot, great value."),
    ("maya", "Taco Tuesday", (("Veg Burrito", 1), ("Churros", 1)), 2,
     OrderStatus.CANCELLED, None, None),
    ("maya", "Dosa Dash", (("Ghee Roast Dosa", 1), ("Mango Lassi", 1)), 1,
     OrderStatus.DELIVERED, 3, "Good, but the lassi was too sweet."),
    ("leo", "Burger Barn", (("Double Stack", 2), ("Peri Peri Fries", 1)), 5,
     OrderStatus.DELIVERED, 5, "Best burgers on campus."),
    ("leo", "Taco Tuesday", (("Crunchy Tacos", 2), ("Horchata", 1)), 2,
     OrderStatus.DELIVERED, 4, "Tasty tacos."),
)


def seed_sample_orders(db: Session) -> int:
    """Order history for the two test customers so order lists, reviews and insights have data."""
    users = {u.email.split("@")[0]: u for u in db.scalars(select(User))}
    partner = users["sam"]
    has_orders = {
        name: db.scalar(select(Order.id).where(Order.customer_id == users[name].id)) is not None
        for name in ("maya", "leo")
    }
    created = 0
    for customer, restaurant_name, lines, days_ago, status, rating, comment in SAMPLE_ORDERS:
        if has_orders[customer]:
            continue
        restaurant = db.scalar(select(Restaurant).where(Restaurant.name == restaurant_name))
        dishes = {
            d.name: d.id
            for d in db.scalars(select(MenuItem).where(MenuItem.restaurant_id == restaurant.id))
        }
        request = OrderCreate(
            items=[OrderLineIn(menu_item_id=dishes[name], quantity=qty) for name, qty in lines],
            delivery_address="Hostel Block B, Room 204",
        )
        order = place_order(db, users[customer], request)
        placed_at = utc_now() - timedelta(days=days_ago)
        order.created_at = placed_at
        order.updated_at = placed_at + timedelta(minutes=45)
        if status is OrderStatus.CANCELLED:
            cancel_order(db, users[customer], order.id)
        else:
            order.status = status
        if status is OrderStatus.DELIVERED:
            order.delivery_partner_id = partner.id
        if rating is not None:
            db.add(
                Review(
                    order_id=order.id,
                    customer_id=order.customer_id,
                    restaurant_id=order.restaurant_id,
                    rating=rating,
                    comment=comment,
                    created_at=placed_at + timedelta(hours=2),
                )
            )
        db.commit()
        created += 1
    return created


def main() -> int:
    password = os.environ.get("SEED_PASSWORD", "")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Set SEED_PASSWORD to at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        created = seed_users(db, password)
        restaurants_created, dishes_created = seed_restaurants(db)
        orders_created = seed_sample_orders(db)
    print(f"Created {created} test accounts, skipped {len(TEST_ACCOUNTS) - created}.")
    print(f"Created {restaurants_created} restaurants and {dishes_created} dishes.")
    print(f"Created {orders_created} past orders for the test customers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
