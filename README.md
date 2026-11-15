# CampusBite

A full-stack restaurant ordering and delivery application for campus. Customers browse restaurants, order with a dummy payment, track their orders, review them and ask an AI assistant about their order history. Restaurant owners manage their menu and kitchen queue. Delivery partners handle their assigned deliveries.

## Features

**Everyone**
- Browse restaurants and menus, search dishes by name and price range, filter veg or non-veg, with pagination.
- Read public restaurant and dish reviews, and see each restaurant's average rating.
- Register and log in. Only `@masaischool.ac.in` email addresses are accepted. Passwords are hashed with bcrypt and sessions use JWT tokens.

**Customer**
- Place an order from one restaurant with a dummy payment (the order is marked `mock_paid` and a payment record is saved).
- See order history with status and date filters, and track each order's status.
- Cancel an order while it is still `PLACED`.
- Rate and review an order after it is delivered (one review per order).
- Ask for a return and refund after delivery, with a reason (one request per order).
- Ask questions about their own orders in plain language, answered by OpenAI.

**Restaurant owner**
- Add dishes, edit them and mark them available or unavailable.
- See incoming orders with status and date filters, accept them and move them to preparing and ready.
- Assign a delivery partner to a ready order.
- Approve or reject return requests (an approved return refunds the payment and marks the order `REFUNDED`).
- See basic restaurant statistics and reminders for orders that have waited more than 15 minutes without an update.

**Delivery partner**
- See only the orders assigned to them, with the customer's delivery details.
- Mark an order out for delivery and delivered, and see their delivery history.

Access to each of these is enforced on the backend by role, not only hidden in the interface.

## Technologies

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript (ES6+), Hooks, React Router DOM, Fetch API, Vite |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic, JWT, bcrypt |
| Database | PostgreSQL (runtime), SQLite (automated tests only) |
| AI | OpenAI API through the official `openai` SDK |
| Packaging | Docker and Docker Compose |

## Repository layout

```
backend/    FastAPI application, migrations and tests
frontend/   React application
docs/       Problem statement, specification, UX notes
docker-compose.yml   Backend and PostgreSQL
.env.example         Names of all settings, placeholder values only
```

## Run the backend with Docker Compose

You need Docker. From the repository root:

1. Create your settings file and fill it in:
   ```
   cp .env.example .env
   ```
   Then edit `.env`:
   - Set `JWT_SECRET` to a long random value: `openssl rand -hex 32`. The app refuses to start with a short secret.
   - Change `POSTGRES_PASSWORD`. Use only letters and digits, for example `openssl rand -hex 16`: characters such as `@` or `/` break the database connection URL.
   - Optional: set `OPENAI_API_KEY` and `OPENAI_MODEL` to use the AI feature. Without them, the AI route answers 503 and everything else works.
   - Optional: set `SEED_PASSWORD` (at least 8 characters) to create test accounts.
2. Start PostgreSQL and the API:
   ```
   docker compose up --build
   ```
   Database migrations run automatically on start. Run it again with `--build` after changing code, because the code is copied into the image.
3. Check it: http://localhost:8000/health should return `{"status":"ok","database":"up"}`.
4. Stop it with `docker compose down`. Add `-v` to also delete the database data.

The `.env` file is ignored by git. Never commit it.

### Database setup

- PostgreSQL runs in the `db` container, with its data in the `db_data` volume. Credentials come from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` in `.env`.
- The schema is managed by Alembic migrations in `backend/alembic/versions`. They apply on every start (`alembic upgrade head`).
- Tables: `users`, `restaurants`, `menu_items`, `orders`, `order_items`, `reviews`, `payment_ledger` and `admin_reminder_logs`.
- To start from an empty database: `docker compose down -v`, then `docker compose up --build`.

### Test accounts

With `SEED_PASSWORD` set in `.env` and the stack running:

```
docker compose run --rm backend python -m app.seed
```

This creates the accounts below, the 4 restaurants and their dishes. It is safe to run again: anything that exists is skipped. All accounts use the password you set. For local use only.

| Email | Role |
|---|---|
| maya@masaischool.ac.in, leo@masaischool.ac.in | Customer |
| owner1@masaischool.ac.in (Dosa Dash), owner3@masaischool.ac.in (Burger Barn), owner5@masaischool.ac.in (Taco Tuesday), owner7@masaischool.ac.in (Chai & Chill) | Restaurant owner |
| sam@masaischool.ac.in, priya@masaischool.ac.in, jonah@masaischool.ac.in | Delivery partner |

### Run the backend tests

The tests use an in-memory SQLite database and need no OpenAI key:

```
docker compose run --rm --no-deps -e DATABASE_URL=sqlite:///:memory: backend pytest
docker compose run --rm --no-deps backend ruff check .
```

## Environment variables

All names are in `.env.example`. Values there are placeholders only.

| Variable | Purpose | Default |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials. Compose builds `DATABASE_URL` from them | none |
| `BACKEND_PORT` | Host port for the API | 8000 |
| `JWT_SECRET` | Key for signing login tokens, at least 32 characters | none (required) |
| `JWT_ALGORITHM` | Signing algorithm, only `HS256` is allowed | HS256 |
| `JWT_EXPIRE_MINUTES` | How long a login token lasts | 60 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI key and model name for AI insights. The key stays in the backend only | empty |
| `AI_QUESTIONS_PER_MINUTE` | AI questions allowed per customer per minute | 5 |
| `CORS_ORIGINS` | Comma separated browser origins allowed to call the API | http://localhost:5173 |
| `REMINDER_STALE_MINUTES` | Minutes an order may stay `PLACED` or `ACCEPTED` before a reminder | 15 |
| `REMINDER_CHECK_SECONDS` | How often the background task looks for stale orders (0 turns it off) | 60 |
| `APP_TIMEZONE` | Time zone for date filters and "today" | Asia/Kolkata |
| `SEED_PASSWORD` | Password for the test accounts made by the seed script | none |

## API documentation

With the backend running:

- Interactive docs (Swagger UI): http://localhost:8000/docs
- Alternative docs (ReDoc): http://localhost:8000/redoc
- Machine-readable schema: http://localhost:8000/openapi.json

Every route has a description, and lists the errors it can return. To try protected routes: call `POST /auth/login`, copy the `access_token`, click **Authorize** and paste the token only, without the word `Bearer`. Tokens last 60 minutes.

Errors use the shape `{"detail": {"code": "...", "message": "..."}}`. Validation errors (422) use FastAPI's standard list shape.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Browse (public) | `GET /restaurants`, `GET /restaurants/{id}`, `GET /restaurants/{id}/menu` |
| Reviews (public) | `GET /restaurants/{id}/reviews`, `GET /menu-items/{id}/reviews` |
| Customer orders | `POST /orders`, `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel`, `POST /orders/{id}/review`, `POST /orders/{id}/return` |
| AI insights | `POST /insights` |
| Owner menu | `GET /owner/menu`, `POST /owner/menu`, `PATCH /owner/menu/{id}`, `PATCH /owner/menu/{id}/availability` |
| Owner orders | `GET /owner/orders`, `GET /owner/orders/{id}`, `PATCH /owner/orders/{id}/status`, `PATCH /owner/orders/{id}/assign`, `GET /owner/delivery-partners` |
| Owner returns and more | `GET /owner/returns`, `PATCH /owner/orders/{id}/return`, `GET /owner/reminders`, `GET /owner/stats` |
| Delivery partner | `GET /delivery/orders`, `GET /delivery/orders/{id}`, `PATCH /delivery/orders/{id}/status` |
| System | `GET /health` |

### Order lifecycle

`PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `ASSIGNED` → `OUT_FOR_DELIVERY` → `DELIVERED`, plus `CANCELLED` and `REFUNDED`.

- A customer can cancel only while `PLACED`. The payment is then marked `refunded`.
- The owner moves an order from `PLACED` to `READY` one step at a time, then assigns a delivery partner, which sets `ASSIGNED`.
- The delivery partner moves `ASSIGNED` to `OUT_FOR_DELIVERY` to `DELIVERED`, and only for orders assigned to them.
- After delivery, the customer can review once and ask for a return once. If the owner approves the return, the order becomes `REFUNDED`. If the owner rejects it, the order stays `DELIVERED`.
- Any other step is refused by the backend with a `409`.

## Frontend

The React application is in `frontend/`. To run it:

```
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. Other commands: `npm run build`, `npm run lint` and `npm test`.

**Status:** the frontend is being connected to the backend one area at a time. Login, register, logout, restaurants, menus, the cart and checkout (placing an order) already use the real API. Start the backend first (see above), then log in with a seeded account such as `maya@masaischool.ac.in` and the `SEED_PASSWORD` you set. The other screens still show built-in sample data until their turn. The API address comes from `VITE_API_BASE_URL` in `frontend/.env.example` (default `http://localhost:8000`).

## Documentation

- [docs/problem-statement.md](docs/problem-statement.md): the requirements this project follows
- [docs/SPEC.md](docs/SPEC.md): specification
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md): commit format, branch and pull request rules, code style

## License

[MIT](LICENSE)
