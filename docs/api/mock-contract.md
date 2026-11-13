# Mock API contract

The frontend talks to `frontend/src/api`, an in-memory mock that returns the shapes the FastAPI backend will return. Every function is async and waits for a simulated latency (400 ms by default, 0 in tests). Mutable data lives in `store.js`, rebuilt from fixtures on reload. Backend slices should match these shapes. Each unit appends its endpoints below.

## Conventions
- JSON fields are snake_case, ids are integers, dates are ISO-8601 UTC strings.
- Lists return `{ items, total, page, page_size }` (1-based page).
- Failures throw `ApiError` with `status`, `code` and `message`.
- Roles: `CUSTOMER`, `OWNER`, `DELIVERY_PARTNER`.
- The access token is the string `mock.<user_id>`, stored with the user in localStorage under `campusbite.session`. `password` is never returned.

## Auth

### `auth.login({ email, password })`
Email is trimmed and compared case-insensitively.

Response:
```
{ access_token: "mock.1", token_type: "bearer", user: { id, name, email, role, restaurant_id? } }
```
`restaurant_id` is present for owners only.

| Status | Code | When |
| --- | --- | --- |
| 401 | `invalid_credentials` | Unknown email or wrong password |

### `auth.register({ name, email, password })`
Always creates a `CUSTOMER`; a `role` key in the payload is ignored. Email is trimmed, lowercased and compared case-insensitively. Response: the new user object without password. The auth context then logs in with the same credentials.

| Status | Code | When |
| --- | --- | --- |
| 409 | `email_taken` | An account with that email already exists |

### `auth.getCurrentUser()`
Reads the saved token. Response: the user object above.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | No token, malformed token or unknown user id |

## Restaurants

### `restaurants.listRestaurants({ q, page = 1, page_size = 6 })`
Public. `q` matches restaurant name or cuisine, case-insensitive substring. Response: the list envelope `{ items, total, page, page_size }`, each item `{ id, name, cuisine, description, owner_id, is_open, created_at }`. A page past the end returns empty `items` with the real `total`.

### `restaurants.getRestaurant(id)`
Public. Response: one restaurant object.

| Status | Code | When |
| --- | --- | --- |
| 404 | `not_found` | No restaurant with that id |

### `restaurants.listMenu(restaurantId, { q, min_price, max_price, page = 1, page_size = 50 })`
Public. `q` matches item name or category, case-insensitive substring. `min_price` and `max_price` are inclusive and optional. Unavailable items are included with `is_available: false` for every caller. Response: the list envelope, each item `{ id, restaurant_id, name, description, category, price, is_available, created_at }`; `price` is a number with at most two decimals.

| Status | Code | When |
| --- | --- | --- |
| 404 | `not_found` | No restaurant with that id |
| 422 | `invalid_price_range` | `min_price` is greater than `max_price` |

## Shared errors
| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `unauthenticated` | Missing or invalid token |
| 403 | `forbidden` | Signed in with the wrong role |
