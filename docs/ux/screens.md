# Screens

Each route, who may open it, and the states it has. Each unit appends its routes.

| Route | Access | States |
| --- | --- | --- |
| `/` | Everyone | Success (placeholder home). Shows the redirect notice when a user was sent home from a route of another role |
| `/login` | Guests (signed-in users are sent to their home) | Idle, field errors (empty email or password), submitting (button loading), form error (`role="alert"` for wrong credentials or failure) |
| `/owner` | `OWNER` | Loading skeleton while the session restores, placeholder empty state |
| `/delivery` | `DELIVERY_PARTNER` | Loading skeleton while the session restores, placeholder empty state |

## Access rules
- Guests opening a protected route go to `/login` and return to the original path after signing in.
- A signed-in user opening a route of another role is sent to their home with a one-line notice. Homes: customer `/`, owner `/owner`, delivery partner `/delivery`.
- Navigation shows only routes that exist: guests see Home, Log in, Styleguide; owners add Orders; delivery partners add Deliveries. Signed-in users also see their name and a Log out button.
