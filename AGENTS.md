# AGENTS.md

Rules for any agent working in this repository. Read this first.

## Project
CampusBite is a restaurant ordering and delivery platform. Spec: [docs/SPEC.md](docs/SPEC.md). Plan and slice cards: `docs/roadmap/`.

## Mandated stack
- Frontend: React, JavaScript (ES6+), Hooks, React Router DOM, Fetch API, Vite
- Backend: Python, FastAPI, Pydantic, SQLAlchemy, JWT auth, bcrypt, Docker and Docker Compose
- Database: PostgreSQL at runtime, SQLite for automated tests only, always through SQLAlchemy
- AI: OpenAI API via the official `openai` SDK, model name from an env var
- Excluded: TypeScript, Redux/Zustand, other ORMs, other databases, APScheduler/Celery

## Branches
- A new branch per feature or slice, named `<type>/<id>-<slug>` (for example `feat/1.5-order-lifecycle`), created from the latest `main`.
- Nothing is ever committed directly to `main`.

## Authorship
- The repository owner is the only author of every commit.
- No `Co-authored-by` trailer, "Generated with" line or agent signature anywhere: commits, PR titles and bodies, code comments, file headers, docs, changelog.
- Use the repo's configured git identity. Never run `git config user.*`, never pass `--author`, never set `GIT_AUTHOR_*` or `GIT_COMMITTER_*`.

## Commits
Format: `type(scope): imperative subject`. One line, no body, no trailers, header at most 72 characters.
- Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `build`, `ci`, `chore`
- Scopes (only these): `repo`, `ci`, `docker`, `deps`, `docs`, `config`, `db`, `auth`, `restaurants`, `menu`, `cart`, `orders`, `payments`, `delivery`, `stats`, `reviews`, `refunds`, `reminders`, `ai`, `middleware`, `ui`
- One commit is one scope and one logical change. A new scope needs its own `chore(repo)` commit editing `commitlint.config.cjs` first.
- Review fixes are new `fix(<scope>)` commits, not history rewrites.

## Pull requests
- Agents never push and never open a PR unless the owner asks.
- Title: `type(scope): imperative summary`, at most 72 characters, one scope per PR, one PR per slice.
- Body follows `.github/PULL_REQUEST_TEMPLATE.md`. No agent footer.
- Merge is rebase-merge only.

## Code style
Follow the charter in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md): domain names, small functions, comments only for the why, abstractions only with two real callers, validate at the boundary, full backend type hints.

## UI
Follow the UX spec in `docs/ux/` when it exists. Preview UI changes on localhost before building further.

## Commands
- `make lint`
- `make test`
- `make up`

These arrive with slices 0.2 to 0.4.

## Never
- Commit secrets. Only placeholder values go in `.env.example` files.
- Add a dependency outside the mandated stack.
- Edit an already-merged migration.
- Use `--no-verify`.
