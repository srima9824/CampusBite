# CampusBite

A full-stack restaurant ordering and delivery platform. Customers browse restaurants and place orders, owners run their menus and kitchen queue, and delivery partners pick up and complete deliveries.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript (ES6+), Hooks, React Router DOM, Fetch API, Vite |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, JWT auth, bcrypt |
| Database | PostgreSQL at runtime, SQLite for automated tests only |
| AI | OpenAI API via the official `openai` SDK |
| Delivery | Docker and Docker Compose, GitHub Actions |

The full specification is in [docs/SPEC.md](docs/SPEC.md).

## Repository layout

```
backend/    FastAPI application and its tests
frontend/   React application
docs/       Specification, ADRs, API docs, contributing guide
.github/    Workflows, issue templates, CODEOWNERS
```

## Quick start

Placeholders until the tooling and Docker slices land.

```
cp .env.example .env
make up      # start the stack with Docker Compose (coming soon)
make test    # run the test suites (coming soon)
```

## Contributing

Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for commit format, branch and pull request rules, and the code style charter.

## License

[MIT](LICENSE)
