# Screens

Each route, who may open it, and the states it has. Each unit appends its routes.

| Route | Access | States |
| --- | --- | --- |
| `/` | Everyone | Success (placeholder home). Shows the redirect notice when a user was sent home from a route of another role |
| `/login` | Guests (signed-in users are sent to their home) | Idle, field errors (empty email or password), submitting (button loading), form error (`role="alert"` for wrong credentials or failure) |
| `/register` | Guests (signed-in users are sent to their home) | Idle, field errors per input (name, email, password under 8 characters, mismatch), `email_taken` shown on the email field, submitting, form error. Success signs in and goes to the customer home |
| `/owner` | `OWNER` | Loading skeleton while the session restores, placeholder empty state |
| `/delivery` | `DELIVERY_PARTNER` | Loading skeleton while the session restores, placeholder empty state |
| `/restaurants` | Everyone (customer home) | Loading (six skeleton cards), success (grid, 1 column at 375px, 2 at 768px, 3 at 1024px, pagination when more than 6), empty ("No kitchens match that" with Clear search), error (`role="alert"` with Retry). Search and page live in `?q=&page=` |
| `/restaurants/:restaurantId` | Everyone | Loading (skeleton blocks), success (header, items grouped under one `h2` per category, unavailable items carry a "Sold out" text badge), empty ("Nothing on the menu matches" with Clear filters), error (`role="alert"` with Retry), inline `role="alert"` when min price is above max (the range is not sent), not found for an unknown id (link back to the list). Filters live in `?q=&min_price=&max_price=` |

## Access rules
- Guests opening a protected route go to `/login` and return to the original path after signing in.
- A signed-in user opening a route of another role is sent to their home with a one-line notice. Homes: customer `/restaurants`, owner `/owner`, delivery partner `/delivery`.
- Navigation shows only routes that exist: guests see Home, Restaurants, Log in, Sign up, Styleguide; customers see Home, Restaurants, Styleguide; owners add Orders; delivery partners add Deliveries. Signed-in users also see their name and a Log out button.
