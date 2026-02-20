# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: Next.js 16 + TypeScript app (`src/app` for routes, `src/components` for UI, `src/services` for API clients, `src/types` for shared types).
- `backend/`: FastAPI service (`app/api` routes, `app/services` business logic, `app/dao` database access, `app/models` SQLAlchemy models, `app/schemas` Pydantic schemas).
- `backend/tests/`: Pytest suite split by layer (`api/`, `dao/`, `services/`).
- Root: `docker-compose.yml` and `.env` for local orchestration and configuration.

## Build, Test, and Development Commands
- `docker-compose up --build`: start full stack locally (recommended).
- `cd backend && uv sync`: install backend dependencies.
- `cd backend && uv run dev`: run FastAPI dev server on `:8000`.
- `cd backend && uv run pytest`: run backend tests.
- `cd frontend && pnpm install`: install frontend dependencies.
- `cd frontend && pnpm dev`: run Next.js dev server on `:3000`.
- `cd frontend && pnpm build`: create production frontend build.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, type hints for public functions, keep route handlers thin and push logic into `services/`.
- TypeScript/React: functional components, PascalCase for component filenames (for example, `AudioUpload.tsx`), camelCase for variables/functions, colocate component CSS when needed.
- Follow existing directory conventions: one DAO/service per domain model (`user_dao.py`, `auth_service.py`).

## Testing Guidelines
- Framework: `pytest` (backend). Place tests under `backend/tests/<layer>/test_<feature>.py`.
- Prefer deterministic unit tests for `dao` and `services`; use API tests for endpoint behavior.
- Run `cd backend && uv run pytest` before opening a PR.
- Frontend automated tests are not configured yet; include manual verification steps in PRs for UI changes.

## Commit & Pull Request Guidelines
- Current history uses short, imperative summaries (for example, `frontend changes`, `refactor backend`).
- Prefer clearer format: `<scope>: <imperative summary>` (example: `backend: add rubric DAO validation`).
- Keep commits focused and small; avoid mixing backend and frontend refactors unless required.
- PRs should include: purpose, key changes, test evidence (`uv run pytest` output), related issue, and screenshots/video for UI updates.

## Security & Configuration Tips
- Never commit secrets; keep credentials in root `.env`.
- Required integrations include Supabase and OpenAI keys; confirm `FRONTEND_URL` and `BACKEND_URL` match local runtime.
