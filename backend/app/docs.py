from typing import Any

Responses = dict[int | str, dict[str, Any]]

NOT_LOGGED_IN = "Not logged in: the token is missing, invalid or expired. Log in again."
WRONG_ROLE = "Logged in, but this account type is not allowed to use this route."

TAGS_METADATA: list[dict[str, str]] = [
    {
        "name": "auth",
        "description": "Create a customer account, log in and check who is logged in.",
    },
    {
        "name": "restaurants",
        "description": "Browse restaurants and their menus. Anyone can use these routes, no login "
        "needed.",
    },
    {
        "name": "owner menu",
        "description": "Restaurant owners manage the dishes of their own restaurant. Owner login "
        "required.",
    },
    {
        "name": "orders",
        "description": "Customers place orders with the dummy payment and look at their own "
        "orders. Customer login required.",
    },
    {"name": "system", "description": "Service status."},
]


def described(details: dict[int, str]) -> Responses:
    return {code: {"description": text} for code, text in details.items()}
