# CampusBite specification

CampusBite is a restaurant ordering and delivery platform: customers browse and order, owners run their restaurant's orders and menu, delivery partners deliver.

The delivery plan is `claude/plan/iteration-1.md`. The original problem statement is not in this repository yet; add it as `docs/problem-statement.md` and complete the traceability matrix below.

## Mandated stack
| Layer | Required |
|---|---|
| Frontend | React, JavaScript (ES6+), Hooks, React Router DOM, Fetch API, Vite for builds |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, JWT auth, bcrypt, Docker and Docker Compose |
| Database | PostgreSQL at runtime, SQLite for automated tests only, always through SQLAlchemy |
| AI | OpenAI API via the official `openai` SDK |

Excluded: TypeScript, Redux/Zustand, other ORMs, other databases, APScheduler/Celery.

## Roles
`CUSTOMER` (self-registers), `OWNER` and `DELIVERY_PARTNER` (created by CLI/seed).

## Order lifecycle
PLACED -> ACCEPTED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED. A customer may cancel only from PLACED.

## Phases
0 Foundation, 1 Backend core, 2 Frontend, 3 Hardening and v0.1.0, 4 Reviews, 5 Refunds, 6 Reminders, 7 AI insights, 8 Release hardening v1.0.0. Slice cards live in `docs/roadmap/`.

## Traceability matrix
| Requirement | Slice | Proving test |
|---|---|---|
| (fill from the problem statement) | | |
