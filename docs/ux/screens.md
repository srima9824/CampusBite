# Screens

Each route, who may open it, and the states it has. Each unit appends its routes.

| Route | Access | States |
| --- | --- | --- |
| `/` | Everyone | Success (placeholder home). Shows the redirect notice when a user was sent home from a route of another role |
| `/login` | Guests (signed-in users are sent to their home) | Idle, field errors (empty email or password), submitting (button loading), form error (`role="alert"` for wrong credentials or failure) |
| `/register` | Guests (signed-in users are sent to their home) | Idle, field errors per input (name, email, password under 8 characters, mismatch), `email_taken` shown on the email field, submitting, form error. Success signs in and goes to the customer home |
| `/owner` | `OWNER` | Loading skeleton rows, success (own restaurant's orders newest first, 10 per page, table from 768px and stacked cards below; each row has an items `<details>` with quantities, address and note, and the one next action: Accept order, Start preparing, Mark ready; READY rows get a rider select and Assign rider; later rows show "With rider NAME"), empty ("No orders yet, the oven is bored"), empty filtered ("No orders match those filters" with Clear filters), empty page past the end ("That page is empty" with Back to first page), error (`role="alert"` with Retry). A 409 from the api shows an error toast and reloads. Filters and page live in `?status=&date_from=&date_to=&page=` |
| `/delivery` | `DELIVERY_PARTNER` | Loading skeleton while the session restores, placeholder empty state |
| `/restaurants` | Everyone (customer home) | Loading (six skeleton cards), success (grid, 1 column at 375px, 2 at 768px, 3 at 1024px, pagination when more than 6), empty ("No kitchens match that" with Clear search), error (`role="alert"` with Retry). Search and page live in `?q=&page=` |
| `/restaurants/:restaurantId` | Everyone | Loading (skeleton blocks), success (header, items grouped under one `h2` per category, unavailable items carry a "Sold out" text badge), empty ("Nothing on the menu matches" with Clear filters), error (`role="alert"` with Retry), inline `role="alert"` when min price is above max (the range is not sent), not found for an unknown id (link back to the list). Filters live in `?q=&min_price=&max_price=` |
| `/cart` | Everyone (guests may fill it; checkout asks them to sign in) | Empty ("Your cart is on a diet" with Browse restaurants), success (lines with quantity stepper 1 to 20, line total, Remove, subtotal, Clear cart through a confirm dialog). No loading or error state: the cart lives in the browser |
| `/checkout` | `CUSTOMER` (guests go to login and come back; other roles are sent home) | Empty cart redirects to `/cart`. Idle form, address error under the field, submitting (Pay button loading), api error (`role="alert"`, with a link to the cart when a dish sold out) |
| `/order-confirmation/:orderId` | `CUSTOMER`, own orders only | Loading skeleton, success (order number, status badge, items and totals, address, "Paid (dummy)", links to track the order, view all orders and order more), not found (also for another customer's order), error (`role="alert"` with Retry) |
| `/orders` | `CUSTOMER` | Loading skeleton rows, success (table at 768px and up, stacked cards below, newest first, 10 per page, Cancel only on PLACED rows), empty ("No orders yet, your stomach is waiting" with Browse restaurants), empty filtered ("No orders match those filters" with Clear filters), error (`role="alert"` with Retry). Filters and page live in `?status=&date_from=&date_to=&page=`; a start date after the end date shows an inline error and is not sent |
| `/orders/:orderId` | `CUSTOMER`, own orders only | Loading skeleton, success (status badge, progress timeline, items and totals, address, note, rider name or "No rider yet", "Paid (dummy)", Refresh with an "Updated" status message, Cancel while PLACED), not found (also for another customer's order), error (`role="alert"` with Retry) |

## Access rules
- Guests opening a protected route go to `/login` and return to the original path after signing in.
- A signed-in user opening a route of another role is sent to their home with a one-line notice. Homes: customer `/restaurants`, owner `/owner`, delivery partner `/delivery`.
- Navigation shows only routes that exist: guests see Home, Restaurants, Cart, Log in, Sign up, Styleguide; customers see Home, Restaurants, My orders, Cart, Styleguide; owners add Orders; delivery partners add Deliveries. Signed-in users also see their name and a Log out button.
- The Cart link shows the number of items in the cart; its accessible name reads "Cart, 3 items".
