import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app import seed
from app.models import MenuItem, Restaurant, User

PASSWORD = "seed-pass-1234"

OWNER_BY_RESTAURANT = {
    "Dosa Dash": "owner1@masaischool.ac.in",
    "Burger Barn": "owner3@masaischool.ac.in",
    "Taco Tuesday": "owner5@masaischool.ac.in",
    "Chai & Chill": "owner7@masaischool.ac.in",
}


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


@pytest.fixture
def seeded(db_session):
    seed.seed_users(db_session, PASSWORD)
    result = seed.seed_restaurants(db_session)
    return db_session, result


def test_seed_creates_four_restaurants_and_thirty_two_dishes(seeded):
    db, result = seeded

    assert result == (4, 32)
    assert count(db, Restaurant) == 4
    assert count(db, MenuItem) == 32


@pytest.mark.parametrize(("name", "owner_email"), OWNER_BY_RESTAURANT.items())
def test_each_restaurant_is_linked_to_its_owner(seeded, name, owner_email):
    db, _ = seeded

    restaurant = db.scalar(select(Restaurant).where(Restaurant.name == name))
    owner = db.get(User, restaurant.owner_id)

    assert owner.email == owner_email


def test_second_run_creates_nothing(seeded):
    db, _ = seeded

    result = seed.seed_restaurants(db)

    assert result == (0, 0)
    assert count(db, Restaurant) == 4
    assert count(db, MenuItem) == 32


def test_main_prints_restaurant_and_dish_counts(db_session, monkeypatch, capsys):
    factory = sessionmaker(bind=db_session.get_bind(), expire_on_commit=False)
    monkeypatch.setattr(seed, "SessionLocal", factory)
    monkeypatch.setenv("SEED_PASSWORD", PASSWORD)

    assert seed.main() == 0

    assert "Created 4 restaurants and 32 dishes." in capsys.readouterr().out


def test_missing_owner_raises_lookup_error_and_commits_nothing(db_session):
    seed.seed_users(db_session, PASSWORD)
    owner3 = db_session.scalar(select(User).where(User.email == "owner3@masaischool.ac.in"))
    db_session.delete(owner3)
    db_session.commit()

    with pytest.raises(LookupError, match="owner3@masaischool.ac.in"):
        seed.seed_restaurants(db_session)
    db_session.rollback()

    assert count(db_session, Restaurant) == 0
    assert count(db_session, MenuItem) == 0


def test_every_restaurant_has_veg_and_non_veg_dishes(seeded):
    db, _ = seeded

    for restaurant in db.scalars(select(Restaurant)):
        dishes = select(MenuItem.is_veg).where(MenuItem.restaurant_id == restaurant.id)
        flags = set(db.scalars(dishes))
        assert flags == {True, False}, restaurant.name


def test_some_dish_is_unavailable(seeded):
    db, _ = seeded

    unavailable = db.scalar(
        select(func.count()).select_from(MenuItem).where(MenuItem.is_available.is_(False))
    )

    assert unavailable >= 1


def test_all_prices_are_positive(seeded):
    db, _ = seeded

    assert db.scalar(select(func.min(MenuItem.price))) > 0
