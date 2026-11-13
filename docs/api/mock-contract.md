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

### `auth.getCurrentUser()`
Reads the saved token. Response: the user object above.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | No token, malformed token or unknown user id |

## Shared errors
| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `unauthenticated` | Missing or invalid token |
| 403 | `forbidden` | Signed in with the wrong role |
