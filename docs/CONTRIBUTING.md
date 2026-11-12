# Contributing

## Branches

- One branch per feature or slice, named `<type>/<id>-<slug>`, for example `feat/1.5-order-lifecycle`.
- Create it from the latest `main`.
- Nothing is ever committed directly to `main`. All changes arrive through a pull request.

## Commits

Format: `type(scope): imperative subject`. One line, no body, no trailers.

- Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `build`, `ci`, `chore`.
- Scopes (the only allowed ones):
  - Foundation: `repo`, `ci`, `docker`, `deps`, `docs`, `config`, `db`
  - Features: `auth`, `restaurants`, `menu`, `cart`, `orders`, `payments`, `delivery`, `stats`, `reviews`, `refunds`, `reminders`, `ai`, `middleware`, `ui`
- A new scope needs its own `chore(repo)` commit that edits `commitlint.config.cjs` first.
- One commit is one scope and one logical change. Backend and frontend work for the same feature are separate commits with the same scope.
- Header is at most 72 characters.
- Review fixes are new `fix(<scope>)` commits, not history rewrites.

The commit author is the repository owner only. No `Co-authored-by` trailer and no tool or agent attribution in commits, pull requests, code or docs.

## Pull requests

- Title: `type(scope): imperative summary`, at most 72 characters, one scope per PR.
- One PR per slice. Fill in `.github/PULL_REQUEST_TEMPLATE.md`.
- Merge: rebase-merge only, after required checks pass, to keep a linear history.

## Code style charter

- **Naming**: domain words (`place_order`, `OrderTransition`, `assign_partner`), not `data`, `handler`, `manager`, `util`.
- **Size**: small functions with one job (ruff `C901` max complexity 10); one React component per file; data fetching in custom hooks (`useOrders`) so JSX stays about layout.
- **Comments**: only for the why or a non-obvious constraint. No comments that restate the code, no banners or step-by-step narration, no docstring on every function, no emoji, no TODO without a reason.
- **Abstractions**: add one when there are two real callers. No base classes or interfaces "for later", no helper used once. Prefer plain functions plus small Pydantic models or dataclasses.
- **Errors**: validate at the boundary (Pydantic, router dependencies) and raise domain exceptions that one handler maps to HTTP responses. No blanket `try/except`, no defensive checks for states that cannot happen.
- **Types**: full type hints in the backend (mypy on `app/`). JavaScript stays JavaScript, with JSDoc only where a shape is not obvious.
- **Tests**: names that read as behaviour (`test_customer_cannot_cancel_after_acceptance`), arrange-act-assert, parametrised tables, never mock the thing under test.
- **Automated**: ruff (`E,F,I,B,UP,SIM,C4,N,C90`), mypy, ESLint (`react`, `react-hooks`, `jsx-a11y`), Prettier, run in pre-commit and CI.
