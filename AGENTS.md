# AGENTS.md

Rules for any agent working in this repository. Read this first.

## Project
CampusBite is a restaurant ordering and delivery platform. Spec: [docs/SPEC.md](docs/SPEC.md). Plan and slice cards: `docs/roadmap/`.

## Development workflow
- One iteration delivers one small, independently reviewable unit. Do not bundle multiple features or start the next unit in the same iteration.
- Develop the frontend first, feature by feature. Keep frontend work independent of unfinished backend APIs; use simple local or mock data where needed.
- After each iteration, leave the app viewable on localhost and report the command and route (or a sample localhost request for backend-only work). Explain what was built and why the main design decisions were made so the owner can review it before the next unit starts.
- Complete the planned frontend units before starting backend implementation. Write automated tests in a dedicated phase after the frontend and backend implementation phases.
- Keep the project structure, test setup, and pipeline small. Use the existing project commands and tools; add a tool or file only when the current unit needs it.
- Do not create E2E tests, gitleaks configuration, `.gitkeep` placeholders, or PR templates. Do not recreate removed scaffolding.
- At the end of every iteration, summarize the unit delivered, the reason for its design decisions, how to preview it locally, and any unresolved limitation.

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
- No agent footer.
- Merge is rebase-merge only.

## Code style
Follow the charter in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md): domain names, small functions, comments only for the why, abstractions only with two real callers, validate at the boundary, full backend type hints.

## UI
Follow the UX spec in `docs/ux/` when it exists. Preview UI changes on localhost before building further.

## Commands
- Use the simplest available project command for the current check. Keep lint and test commands direct and avoid duplicating test layers.
- `make up` starts the local stack when it is available.

Project commands arrive with the tooling and Docker slices.

## Never
- Commit secrets. Only placeholder values go in `.env.example` files.
- Add a dependency outside the mandated stack.
- Edit an already-merged migration.
- Use `--no-verify`.
