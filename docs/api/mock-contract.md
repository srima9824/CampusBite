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

## Orders

### `orders.placeOrder({ restaurant_id, items, delivery_address, note })`
Requires a `CUSTOMER`. `items` is `[{ menu_item_id, quantity }]`. The api snapshots each item's name and price, so a later price change never alters a placed order, and it computes every amount itself; the client sends no prices. Address and note are trimmed. Response: the order.

```
{ id, customer_id, customer_name, restaurant_id, restaurant_name,
  status: 'PLACED',
  items: [{ menu_item_id, name, unit_price, quantity, line_total }],
  subtotal, delivery_fee: 20, total,
  payment: { method: 'mock', status: 'mock_paid' },
  delivery_address, note,
  delivery_partner_id: null, delivery_partner: null,
  status_history: [{ status: 'PLACED', changed_at }],
  created_at, updated_at }
```

`subtotal` is the sum of `line_total`, `total = subtotal + delivery_fee`, all rounded to two decimals.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | No valid token |
| 403 | `forbidden` | The caller is not a customer |
| 422 | `empty_cart` | `items` is missing or empty |
| 422 | `invalid_address` | Address shorter than 5 or longer than 200 characters after trimming |
| 422 | `invalid_quantity` | A quantity is not a whole number from 1 to 20 |
| 404 | `not_found` | Unknown restaurant, or a dish that does not exist |
| 422 | `mixed_restaurants` | A dish belongs to another restaurant than `restaurant_id` |
| 409 | `item_unavailable` | A dish is sold out; the message names it |

### `orders.getOrder(id)`
Any signed-in role may call it, but each sees only its own slice (see Visibility). Response: the order above.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | Not signed in |
| 404 | `not_found` | No such order, or it is outside the caller's slice |

### Visibility
| Role | Sees |
| --- | --- |
| `CUSTOMER` | Orders they placed |
| `OWNER` | Orders of their own restaurant (`restaurant_id`) |
| `DELIVERY_PARTNER` | Orders assigned to them (`delivery_partner_id`) |

### `orders.listOrders({ status, date_from, date_to, page = 1, page_size = 10 })`
Returns `{ items, total, page, page_size }` of the caller's visible orders, newest first. `status` is one of the seven statuses. `date_from` and `date_to` are `YYYY-MM-DD` days in the viewer's local time; `date_to` includes the whole day. Omitted filters match everything.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | Not signed in |
| 422 | `invalid_status` | `status` is not one of the seven values |
| 422 | `invalid_date_range` | A date is not `YYYY-MM-DD`, or `date_from` is after `date_to` |

### `orders.cancelOrder(id)`
Requires a `CUSTOMER` cancelling their own order. Only `PLACED` orders can be cancelled. Sets `CANCELLED`, appends `{ status: 'CANCELLED', changed_at }` to `status_history` and returns the order.

| Status | Code | When |
| --- | --- | --- |
| 403 | `forbidden` | Caller is not a customer |
| 404 | `not_found` | No such order, or it belongs to another customer |
| 409 | `invalid_transition` | The order is no longer `PLACED` |

### Seeded orders
The store starts with 15 orders built relative to the current time (customer 1 has one per status, customer 2 has eight and none cancelled, all in restaurants 1 to 3). Every `status_history` ends with the order's `status`. A page reload resets them.

### Status transitions
One table lives in `src/api/orderStatus.js`. Later units use it to guard status changes; a move outside it throws `409 invalid_transition`.

| From | To | Actor |
| --- | --- | --- |
| PLACED | ACCEPTED | Owner of the restaurant |
| ACCEPTED | PREPARING | Owner of the restaurant |
| PREPARING | READY | Owner of the restaurant |
| READY | OUT_FOR_DELIVERY | Assigned delivery partner |
| OUT_FOR_DELIVERY | DELIVERED | Assigned delivery partner |
| PLACED | CANCELLED | Customer who owns the order |

## Shared errors
| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `unauthenticated` | Missing or invalid token |
| 403 | `forbidden` | Signed in with the wrong role |
