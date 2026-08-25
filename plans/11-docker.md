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
frontend/next.config.ts        # output is gated on BUILD_STANDALONE=1 (Docker only); proxy rewrite
.env.example                   # BACKEND_URL for compose
```

## Tasks
1. `backend/Dockerfile`: `python:3.13-slim` (matches `.python-version`), install deps, copy app, non-root user, expose 8000. `entrypoint.sh` runs `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
2. `frontend/Dockerfile`: multi-stage (deps → build → runner). **Set `ENV BUILD_STANDALONE=1` in the build stage before `next build`** — `next.config.ts` gates `output: "standalone"` on that flag (unset on Vercel, where standalone breaks the build with `ENOENT .next/next-server.js.nft.json`). With the flag set the standalone server is emitted; run `node server.js` on 3000. **`BACKEND_URL` is consumed at `next build` time** — `next.config.js` `rewrites()` is evaluated during the build and the destination is written into the routes manifest — so it **must be a build arg**: `ARG BACKEND_URL` + `ENV BACKEND_URL=$BACKEND_URL` in the build stage, and compose passes `build.args.BACKEND_URL=http://backend:8000`. (Setting it only as a runtime env produces a rewrite to `undefined/api/v1/…`.) Also set it as a runtime `ENV` in the runner stage for consistency.
3. Extend `docker-compose.yml`: `backend` (depends_on postgres+redis healthy, env from `.env`, `DATABASE_URL=postgresql+psycopg2://.../@postgres:5432/...`, `REDIS_URL=redis://redis:6379/0`, `COOKIE_SECURE=false`), `frontend` (depends_on backend, `build.args: BACKEND_URL=http://backend:8000` — the internal service name works because the rewrite is executed by the Next.js server, not the browser). Keep named volumes.
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
- **`BACKEND_URL` IS baked at build time.** `next.config.js` runs during `next build`; the rewrite destination is frozen into `.next/routes-manifest.json`. Pass it as a Docker build `ARG`. If a truly runtime-configurable target is ever needed, replace the config rewrite with an `app/api/v1/[...path]/route.ts` proxy handler — deliberately not done here (more code, must forward `Set-Cookie` by hand).
- **Frontend build needs no backend up** — the rewrite only stores a URL; nothing is fetched at build time.
- **psycopg2 driver in URL:** `postgresql+psycopg2://` for SQLAlchemy; a bare `postgres://` can misparse.
- **Cookie Secure over http in compose:** for local compose you may need `COOKIE_SECURE=false` (http localhost); prod stays true (https). Drive it from env.
- **Slim image missing libpq:** `psycopg2-binary` bundles it, but if you switch to `psycopg2` you'd need `libpq-dev` + build tools. Stay on `-binary`.
- **Alembic autorun race:** without `service_healthy`, the backend may start before Postgres accepts connections.
