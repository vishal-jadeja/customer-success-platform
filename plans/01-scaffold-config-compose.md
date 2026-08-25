# Phase 01 — Repo Scaffold, Config, Compose Skeleton

## Objective
Once done: the repo has a `backend/` FastAPI app and a `frontend/` placeholder, backend boots with `uvicorn` and answers `GET /healthz` 200, configuration is loaded entirely from environment via a typed `Settings` object, `.env.example` documents every variable with no real secrets, and `docker compose up` starts Postgres and Redis (only) with healthchecks and persistent volumes.

## Depends on
Nothing.

## Estimated time
45m.

## Architecture decision recorded here — Next.js reverse proxy (implemented later)

The frontend talks to the backend **through a same-origin Next.js proxy**, not cross-origin. This makes the refresh cookie first-party and kills the Safari-ITP / Chrome third-party-cookie failure mode. Decision + env belong in Phase 01; the `next.config.js` rewrite is implemented at the Phase 03 minimal frontend skeleton and carried into the full Phase 08 foundation.

- `next.config.js` rewrite: `/api/v1/:path*` → `${process.env.BACKEND_URL}/api/v1/:path*`.
- Axios `baseURL='/api/v1'` (relative — never an absolute backend URL); no `withCredentials`.
- Refresh cookie: `httpOnly; Secure; SameSite=Lax`, **no `Domain`**, `Path=/api/v1/auth`.
- `BACKEND_URL` is a **server-side-only** env var (not `NEXT_PUBLIC_`), so the Render URL never ships to the client. On compose it can be `http://backend:8000` because the rewrite runs server-to-server.

## Files created or modified
```
.gitignore                     (already created)
.env.example
docker-compose.yml
backend/
  pyproject.toml               # or requirements.txt
  .dockerignore
  alembic.ini                  # placeholder header only; configured in Phase 02
  app/
    __init__.py
    main.py
    core/
      __init__.py
      config.py
    api/__init__.py
    api/v1/__init__.py
    services/__init__.py
    repositories/__init__.py
    models/__init__.py
    schemas/__init__.py
    llm/__init__.py
frontend/                      # empty placeholder dir; scaffolded in Phase 08
  .gitkeep
```

## Tasks
1. Create `backend/` and `frontend/` (with `.gitkeep`).
2. Add deps (pin versions): `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2.0`, `psycopg2-binary`, `alembic`, `pydantic>=2`, `pydantic-settings`, `pyjwt`, `bcrypt`, `redis`, `httpx`, `slowapi`, `python-multipart`; dev: `pytest`, `fakeredis`, `ruff`.
3. `app/core/config.py`: `Settings(BaseSettings)` with `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`. Fields: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ALGORITHM="HS256"`, `ACCESS_TOKEN_TTL_MIN=15`, `REFRESH_TOKEN_TTL_DAYS=7`, `CORS_ORIGINS: list[str]`, `COOKIE_SECURE: bool=True`, `COOKIE_SAMESITE="lax"`, `GROQ_API_KEY=""`, `GROQ_MODEL`, `CEREBRAS_API_KEY=""`, `CEREBRAS_MODEL` (all four optional — see follow-up), `LLM_PROVIDER_ORDER="groq,cerebras"`, `LLM_TIMEOUT_SECONDS=15`, `LLM_TOTAL_BUDGET_SECONDS=35`, `AI_ENABLED=True`, `RATE_LIMIT_ENABLED=True`, `REFRESH_REUSE_GRACE_SECONDS=10`, `ENV="dev"`. Expose a cached `get_settings()` (`@lru_cache`).
4. `app/main.py`: app factory `create_app()`. Add CORS middleware from `settings.CORS_ORIGINS` (permissive to the app's own origin only). **CORS is no longer load-bearing** — the browser never calls the backend cross-origin (see Reverse proxy below); this config exists only so the Render `/docs` page can be opened directly. `GET /healthz` returns `{"status":"ok"}` (DB/Redis checks wired in Phase 02/03; for now static ok). Module-level `app = create_app()`.
5. `.env.example`: every backend `Settings` key with a placeholder value (e.g. `JWT_SECRET=change-me-32-bytes-min`, `GROQ_API_KEY=gsk_xxx`). Also document the **frontend** `BACKEND_URL` (server-side only, NOT `NEXT_PUBLIC_`) used by the proxy rewrite — the frontend has no public API-URL var. No real keys.
6. `docker-compose.yml`: services `postgres` (image `postgres:16`, env POSTGRES_*, volume `pgdata`, healthcheck `pg_isready`, port 5432) and `redis` (image `redis:7`, volume `redisdata`, healthcheck `redis-cli ping`, port 6379). No app services yet.
7. `.dockerignore`: `__pycache__`, `.venv`, `.pytest_cache`, `*.pyc`, `.env`.

## Error handling requirements
- Missing required env var: `Settings()` raises `pydantic.ValidationError` at startup — that is desired (fail fast, loud). Do not add defaults for secrets.
- `CORS_ORIGINS` parsed from a comma-or-JSON env value; validate it is a non-empty list in non-dev, else log a warning.

## Acceptance criteria
- `uvicorn app.main:app --reload` (with a local `.env`) starts with no error.
- `curl localhost:8000/healthz` → `{"status":"ok"}`, HTTP 200.
- `docker compose up -d postgres redis` → both healthy (`docker compose ps` shows healthy).
- `git status` never lists a real `.env` (only `.env.example` is committed). `plans/` is tracked intentionally.

## Verification
```
cd backend && uvicorn app.main:app --port 8000 &
curl -s localhost:8000/healthz
docker compose up -d postgres redis && docker compose ps
```

## Phase 01 follow-up (from the senior review — do before Phase 02)
Phase 01 is committed (`2ecf567`). Three small corrections to what landed:
1. **LLM keys optional.** `GROQ_API_KEY`, `GROQ_MODEL`, `CEREBRAS_API_KEY`, `CEREBRAS_MODEL` become `str = ""`. A grader without keys must still get a booting app; the failover client skips providers whose key is empty. Add `LLM_TOTAL_BUDGET_SECONDS: int = 35`, `RATE_LIMIT_ENABLED: bool = True`, `REFRESH_REUSE_GRACE_SECONDS: int = 10` (used in 03/06).
2. **passlib → bcrypt.** Replace `passlib[bcrypt]` with `bcrypt` in `pyproject.toml`. passlib 1.7.4 is unmaintained, breaks with `bcrypt>=4.1`, and the repo pins Python 3.13 (stdlib `crypt` removed). Add `fakeredis` to `[dev]`.
3. **`.env.example`:** local default `COOKIE_SECURE=false` (Safari rejects `Secure` over `http://localhost`); prod stays `true`. Document the three new settings.

## Known pitfalls
- **Pydantic v2:** it's `model_config = SettingsConfigDict(...)`, NOT the v1 `class Config`. Using `class Config` silently ignores `env_file`.
- **List env vars:** `CORS_ORIGINS: list[str]` from a plain comma string needs a validator or the `pydantic-settings` JSON form (`["https://x"]`). Decide one and document it in `.env.example`.
- Don't put the DB host as `localhost` in the compose-run `.env`; inside compose the host is the service name (`postgres`), while local uvicorn uses `localhost`. Keep two example URLs commented.
- Don't call `Base.metadata.create_all` anywhere — migrations own the schema (Phase 02).
