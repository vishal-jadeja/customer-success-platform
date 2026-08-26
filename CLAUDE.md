# CLAUDE.md

AI-powered Customer Success Platform (technical assessment): customers, interactions, AI meeting insights, dashboard. Three roles: `admin`, `manager`, `csm`.

## Source of truth
- `plans/00-master-plan.md` — architecture, ERD, RBAC matrix, API surface, error envelope, caching, AI pipeline, cut order. Read it before touching anything.
- `plans/NN-*.md` — one file per phase; work **one phase at a time**, in order, from its task list.
- `plans/PROGRESS.md` — tick items as you go; it records the current phase.

## Stack (locked — do not propose alternatives)
- Backend: Python 3.13, FastAPI, **sync** SQLAlchemy 2.0 + psycopg2-binary, Alembic, Pydantic v2 + pydantic-settings, PostgreSQL, Redis, pyjwt, `bcrypt` (direct — **no passlib**), slowapi, httpx.
- Frontend: Next.js App Router + TypeScript, Redux Toolkit (`createSlice` + `createAsyncThunk`, **no RTK Query**), Axios, Tailwind, react-hook-form + zod, Recharts.
- AI: Groq primary, Cerebras failover, OpenAI-compatible; keys are **optional** — the app must boot without them.
- Deploy: Render (native Python runtime) + Vercel + Neon + Upstash; Dockerfiles + Compose for local/grading.

## Layering (enforced)
`app/api/v1/routers` (HTTP only) → `app/services` (rules, ownership, cache, transactions) → `app/repositories` (**all** SQLAlchemy queries) → `app/models`. Schemas in `app/schemas`, infra in `app/core`, LLM in `app/llm`.
Gate: `grep -rE "select\(|db\.query|session\.execute" backend/app/api/` must return nothing.

## Hard rules
- Schema changes via Alembic only; never `Base.metadata.create_all`. Hand-verify enum `CREATE TYPE`/`DROP TYPE` in migrations.
- Every customer/interaction list or get goes through `apply_customer_scope`; a query that skips it is a data leak.
- Two-level RBAC: `require_roles` on the route **and** `_assert_can_access` in the service. Role-gating in the UI is UX only.
- Uniqueness: insert and catch `IntegrityError` → 409. No existence pre-checks.
- `POST /interactions`: interaction + `pending` insight row committed **before** the LLM call; AI failure updates the row to `failed` and returns 201 — never 5xx, never rollback.
- Cache keys carry the user scope; invalidation is `INCR` on the namespace version key; Redis errors fail open.
- Frontend: axios `baseURL='/api/v1'` (relative, proxied by Next.js), no `withCredentials`, access token in memory only (never localStorage), refresh cookie is `httpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`, no `Domain`.
- `BACKEND_URL` is a **build-time** value for the Next.js rewrite (Vercel env / Docker `ARG`), server-side only.
- Errors use the single JSON envelope `{ "error": { code, message, details, request_id } }`.
- Tests are written at the end of the phase that produces the code, on the shared `backend/tests/conftest.py` (Postgres test DB, fakeredis, rate limit off, dummy LLM keys).

## Commands
```
docker compose up -d postgres redis
cd backend && uvicorn app.main:app --reload --port 8000
cd backend && alembic upgrade head
cd backend && pytest
cd backend && ruff check .
```
Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`; never commit `.env`.

## Git
- Commit only when asked. Short imperative subject; body only if the "why" isn't obvious.
- **Never add a Claude session URL or a `Co-Authored-By` trailer to any commit message in this repo.**
- Never commit secrets; only `.env.example` is tracked.
