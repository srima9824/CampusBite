from dataclasses import dataclass


@dataclass(frozen=True)
class DishSeed:
    name: str
    description: str
    category: str
    price: int
    is_veg: bool
    is_available: bool = True


@dataclass(frozen=True)
class RestaurantSeed:
    name: str
    cuisine: str
    description: str
    logo_key: str
    image_key: str
    owner_email: str
    dishes: tuple[DishSeed, ...]


RESTAURANTS: tuple[RestaurantSeed, ...] = (
    RestaurantSeed(
        name="Dosa Dash",
        cuisine="South Indian",
        description="Crisp dosas and fluffy idlis, served before your lecture ends.",
        logo_key="dosa-dash",
        image_key="south-indian",
        owner_email="owner1@masaischool.ac.in",
        dishes=(
            DishSeed("Masala Dosa", "Crisp rice crepe with spiced potato.", "Dosas", 80, True),
            DishSeed("Ghee Roast Dosa", "Paper-thin and glossy with ghee.", "Dosas", 110, True),
            DishSeed("Cheese Dosa", "Melted cheese folded inside.", "Dosas", 120, True, False),
            DishSeed("Idli Sambar", "Three soft idlis with sambar.", "Breakfast", 60, True),
            DishSeed("Medu Vada", "Crunchy outside, fluffy inside.", "Breakfast", 50, True),
            DishSeed("Filter Coffee", "Strong, frothy and sweet.", "Drinks", 40, True),
            DishSeed("Mango Lassi", "Thick and chilled.", "Drinks", 70, True),
            DishSeed("Egg Dosa", "Crisp dosa with a fried egg spread on top.", "Dosas", 100, False),
            DishSeed(
                "Chicken Chettinad Dosa",
                "Spicy chicken filling in a crisp crepe.",
                "Dosas",
                150,
                False,
            ),
        ),
    ),
    RestaurantSeed(
        name="Burger Barn",
        cuisine="American",
        description="Stacked burgers and golden fries for serious appetites.",
        logo_key="burger-barn",
        image_key="american",
        owner_email="owner3@masaischool.ac.in",
        dishes=(
            DishSeed(
                "Classic Cheeseburger",
                "Juicy patty with cheddar and pickles.",
                "Burgers",
                180,
                False,
            ),
            DishSeed("Double Stack", "Two patties, double the joy.", "Burgers", 260, False),
            DishSeed(
                "Spicy Chicken Burger",
                "Crunchy chicken with hot sauce.",
                "Burgers",
                220,
                False,
                False,
            ),
            DishSeed("Peri Peri Fries", "Golden with a kick.", "Sides", 100, True),
            DishSeed("Onion Rings", "Thick-cut and crisp.", "Sides", 90, True),
            DishSeed("Chocolate Shake", "Thick enough for a spoon.", "Drinks", 150, True),
            DishSeed("Cola", "Ice cold.", "Drinks", 45, True),
        ),
    ),
    RestaurantSeed(
        name="Taco Tuesday",
        cuisine="Mexican",
        description="Tacos and burritos, because every day deserves a Tuesday.",
        logo_key="taco-tuesday",
        image_key="mexican",
        owner_email="owner5@masaischool.ac.in",
        dishes=(
            DishSeed("Veg Burrito", "Beans, rice and salsa wrapped tight.", "Mains", 210, True),
            DishSeed("Crunchy Tacos", "Three shells with fresh fillings.", "Mains", 190, False),
            DishSeed("Quesadilla", "Griddled cheese pocket.", "Mains", 200, True),
            DishSeed("Nachos Supreme", "Loaded with cheese and jalapenos.", "Sides", 170, True),
            DishSeed("Guacamole Cup", "Smashed avocado with chips.", "Sides", 130, True),
            DishSeed("Churros", "Cinnamon sugar and chocolate dip.", "Desserts", 110, True),
            DishSeed("Horchata", "Sweet cinnamon rice drink.", "Drinks", 90, True),
        ),
    ),
    RestaurantSeed(
        name="Chai & Chill",
        cuisine="Cafe",
        description="Hot chai, cold coffee and snacks for long study sessions.",
        logo_key="chai-and-chill",
        image_key="cafe",
        owner_email="owner7@masaischool.ac.in",
        dishes=(
            DishSeed("Masala Chai", "Spiced and steaming.", "Hot drinks", 40, True),
            DishSeed("Ginger Tea", "Zingy comfort in a cup.", "Hot drinks", 45, True),
            DishSeed("Cold Coffee", "Blended and creamy.", "Cold drinks", 110, True),
            DishSeed("Iced Tea", "Peach and mint.", "Cold drinks", 90, True),
            DishSeed("Veg Sandwich", "Grilled with chutney.", "Snacks", 100, True),
            DishSeed("Samosa Pair", "Two crisp samosas.", "Snacks", 50, True),
            DishSeed("Brownie", "Fudgy and rich.", "Desserts", 120, True),
            DishSeed("Chicken Sandwich", "Grilled with mint mayo.", "Snacks", 130, False),
            DishSeed("Egg Puff", "Flaky pastry with a spiced egg.", "Snacks", 60, False),
        ),
    ),
)
