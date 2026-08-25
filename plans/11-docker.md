# Phase 11 — Dockerfiles + Full Compose Orchestration

## Objective
Once done: both apps have production-style Dockerfiles, and `docker compose up` starts the full stack — Postgres, Redis, backend (migrations applied on start), and frontend — reachable and wired together by service name.

## Depends on
Phases 01–10 (working apps).

## Estimated time
45m.

## Files created or modified
```
backend/Dockerfile
backend/.dockerignore          # confirm present
backend/entrypoint.sh          # alembic upgrade head && uvicorn
frontend/Dockerfile
frontend/.dockerignore         # confirm present (node_modules, .next, .env)
docker-compose.yml             # extend: add backend + frontend services
frontend/next.config.js        # confirm output: "standalone" + proxy rewrite
.env.example                   # BACKEND_URL for compose
```

## Tasks
1. `backend/Dockerfile`: `python:3.12-slim`, install deps, copy app, non-root user, expose 8000. `entrypoint.sh` runs `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
2. `frontend/Dockerfile`: multi-stage (deps → build → runner) using Next `output: "standalone"`; run `node server.js` on 3000. `BACKEND_URL` is a **runtime server-side env** (used by the proxy rewrite at request time) — it does **not** need to be a build arg, unlike the old baked `NEXT_PUBLIC_*`.
3. Extend `docker-compose.yml`: `backend` (depends_on postgres+redis healthy, env from `.env`, `DATABASE_URL=postgresql+psycopg2://.../@postgres:5432/...`, `REDIS_URL=redis://redis:6379/0`), `frontend` (depends_on backend, `BACKEND_URL=http://backend:8000` — the internal service name **works now** because the rewrite runs server-to-server, not in the browser). Keep named volumes.
4. Verify inter-service DNS: backend reaches `postgres`/`redis` by service name; the frontend server reaches `backend:8000` by service name; the browser only ever hits `localhost:3000` and its `/api/v1/*` is proxied.

## Error handling requirements
- Migration failure on startup must crash the backend container loudly (non-zero exit) rather than serving against a half-migrated DB — `set -e` in entrypoint.
- `depends_on` with `condition: service_healthy` so backend waits for DB/Redis, avoiding connection-refused races.
- Frontend build must fail the image build on TS/lint errors (don't silently ship broken UI).

## Acceptance criteria
- `docker compose build` succeeds for both images.
- `docker compose up` brings all four services healthy; backend logs show `alembic upgrade head` applied.
- `curl localhost:8000/healthz` → 200; `localhost:3000` loads the app and can log in.
- Seed can be run inside the backend container (`docker compose exec backend python scripts/seed.py`).

## Verification
```
docker compose build
docker compose up -d
docker compose ps                       # all healthy
docker compose exec backend python scripts/seed.py
curl -s localhost:8000/healthz
# open http://localhost:3000, log in with a seeded user
```

## Known pitfalls
- **Browser-vs-container hostname trap is gone.** The proxy makes API calls server-to-server, so `BACKEND_URL=http://backend:8000` (internal DNS) is correct — the browser never resolves it. This is a real simplification the reverse proxy buys us; the old `NEXT_PUBLIC_API_URL=http://localhost:8000` juggling no longer applies.
- **`BACKEND_URL` is runtime, not baked.** Because the rewrite reads `process.env.BACKEND_URL` server-side at request time, it does not need to be a build arg; set it as a container/runtime env.
- **psycopg2 driver in URL:** `postgresql+psycopg2://` for SQLAlchemy; a bare `postgres://` can misparse.
- **Cookie Secure over http in compose:** for local compose you may need `COOKIE_SECURE=false` (http localhost); prod stays true (https). Drive it from env.
- **Slim image missing libpq:** `psycopg2-binary` bundles it, but if you switch to `psycopg2` you'd need `libpq-dev` + build tools. Stay on `-binary`.
- **Alembic autorun race:** without `service_healthy`, the backend may start before Postgres accepts connections.
