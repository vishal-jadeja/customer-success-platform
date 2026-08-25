# PROGRESS

**Current phase:** 07 — DONE (code + tests verified locally; not yet redeployed to Render — Phase 12 handles re-deploy). Backend/frontend from Phase 03 still live on Render/Vercel. **Next: Phase 08 (Frontend foundation).**
**Scope:** Realistic delivery. Summed build ≈16h30–17h; realistic wall-clock 24–30h. Account-Team access cut (see master plan "What I'd build next"); tests written in-phase on a shared `conftest.py` (Phase 03). Cut order on slip: sentiment-trend chart → optional Users page → customer-edit polish. **Never cut:** profile page, interaction detail/edit/filters, Dockerfiles + full Compose.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 01 — Scaffold, config, Compose
- [x] Create `backend/` and `frontend/` top-level dirs
- [x] `backend/pyproject.toml` (or requirements.txt) with pinned deps (incl. `slowapi`)
- [x] `backend/app/` package tree (core, api, services, repositories, models, schemas, llm)
- [x] `app/core/config.py` — pydantic-settings `Settings` (`COOKIE_SAMESITE="lax"`, `LLM_TIMEOUT_SECONDS=15`)
- [x] `app/main.py` — FastAPI app factory, `/healthz`; CORS permissive-to-own-origin (not load-bearing)
- [x] `.env.example` (root or backend) with every key, no secrets; document frontend `BACKEND_URL` (server-side only)
- [x] Record reverse-proxy decision (first-party cookie); implemented at Phase 03 skeleton
- [x] `docker-compose.yml` — postgres + redis only, healthchecks, named volumes
- [x] `backend/.dockerignore` (frontend `.dockerignore` added with the frontend)
- [x] Boot uvicorn locally, `GET /healthz` → 200

### Phase 01 follow-up (senior review)
- [x] `config.py`: LLM keys/models optional (`""`); add `LLM_TOTAL_BUDGET_SECONDS=35`, `RATE_LIMIT_ENABLED=True`, `REFRESH_REUSE_GRACE_SECONDS=10`
- [x] `pyproject.toml`: `passlib[bcrypt]` → `bcrypt`; add `fakeredis` to dev
- [x] `.env.example`: local `COOKIE_SECURE=false`; document new settings; LLM keys marked optional

## Phase 02 — Models, migration, seed
- [x] `app/db.py` — engine (`pool_size=5, max_overflow=5`), `SessionLocal`, `get_db` dependency
- [x] `app/models/` — user, refresh_token, customer, interaction, insight (no customer_assignment)
- [x] Python enums shared with DB enums (no AccountRole)
- [x] `alembic init`, configure `env.py` to import Base + read `DATABASE_URL`
- [x] Generate + hand-verify initial migration (enums have `CREATE TYPE`); `customers.owner_id` ON DELETE RESTRICT
- [x] `alembic upgrade head` succeeds; downgrade/upgrade round-trip clean
- [x] `scripts/seed.py` — users (all roles), customers across owners, interactions, insights `status=completed` `provider='seed'` `latency_ms=NULL`, written directly
- [x] Seed runs idempotently

## Phase 03 — Auth + RBAC + errors + logging + first deploy
- [x] `app/core/security.py` — hash/verify password (**bcrypt directly, no passlib**), encode/decode JWT, refresh token hash
- [x] `app/core/exceptions.py` — AppError hierarchy
- [x] `app/core/errors.py` — exception handlers → JSON envelope; `IntegrityError`→409 (unique email + ON DELETE RESTRICT); also HTTPException/RequestValidationError/RateLimitExceeded/Exception
- [x] `app/core/logging.py` — request-id contextvar + filter + structured formatter
- [x] `app/core/middleware.py` — pure-ASGI request-id middleware (contextvar-safe)
- [x] `app/core/ratelimit.py` — slowapi Limiter keyed on `X-Forwarded-For` first hop, `enabled=RATE_LIMIT_ENABLED`; `10/minute` on `POST /auth/login`
- [x] `app/core/redis.py` — client + fail-open wrapper (safe_get/setex/incr/ping)
- [x] `app/repositories/user.py`, `refresh_token.py`
- [x] `app/services/auth_service.py` — register, login, refresh (rotation + reuse detection with 10 s grace window), logout, update_me
- [x] `tests/conftest.py` — test DB (`csp_test`, auto-created + alembic once, per-test savepoint rollback, `get_db` override), fakeredis, rate-limit off, role fixtures + `token_for`
- [x] `app/core/deps.py` — `get_current_user`, `require_roles`
- [x] `app/api/v1/routers/auth.py`
- [x] **Added beyond spec (user's call):** `/users` admin router (`GET/POST /users`, `PATCH/DELETE /users/{id}`) — `app/schemas/{common,user}.py`, `app/services/user_service.py`, `app/api/v1/routers/users.py`; self-demote/self-deactivate blocked → 409
- [x] Cookie set/clear helpers (httpOnly, Secure, **SameSite=Lax, no Domain**, Path=/api/v1/auth)
- [x] Register→login→me→refresh→logout works via curl (verified manually, see below)
- [x] **Test:** reuse of revoked refresh token → family revoked, 401 (`test_auth.py`) — plus `test_users.py` for `/users` RBAC. 13/13 pass.
- [x] **Senior review pass (post-03):** 500 envelope now carries request id (header + body + log line); CORS-empty warning moved to a model validator; `/auth/refresh` takes a `FOR UPDATE` row lock; seed CSM password ≥8 chars; `next.config.ts` throws if `BACKEND_URL` unset at build; master plan login limit aligned to 10/min. 14/14 pass.
- [x] Minimal Next.js skeleton (`frontend/`) — proxy rewrite (`next.config.ts`), login→`/auth/me` page; build+eslint+tsc clean; proxy round-trip verified locally (cookie lands on the frontend origin, not the backend's)
- [x] **Deploy:** backend on Render + Neon + Upstash; `/healthz` green → `{"status":"ok","db":"ok","redis":"ok"}` at https://customer-success-platform-c2u0.onrender.com/healthz
- [x] **Deploy:** Next.js on Vercel with `next.config.ts` proxy rewrite + `BACKEND_URL` at https://customer-success-platform-murex.vercel.app (see Vercel notes below)
- [x] **Deploy:** login round-trip verified against deployed URLs — first-party cookie `refresh_token; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`, no Domain, set on the Vercel host; proxy `/api/v1/auth/me` returns backend envelope. Prod DB seeded (6 users).

## Phase 04 — Customers
- [x] `app/schemas/customer.py` — create/update/list-item/out; `app/schemas/common.py` gains `PageParams`
- [x] `app/repositories/customer.py` — `apply_customer_scope` (owner_id==self), list/get/count_interactions/create/update/delete; unique-email `IntegrityError` propagates to the existing global 409 handler (no pre-check) — matches the Phase 03 `UserRepository` pattern, not a repo-level catch
- [x] `app/services/customer_service.py` — `_assert_can_access` (own = owner_id==self), `_resolve_owner_id` (csm forced-self/403 on other; admin/manager free, validated via `UserRepository`)
- [x] `app/services/cache_hooks.py` — `invalidate_customers()` no-op stub (Phase 07 wires it)
- [x] `app/api/v1/routers/customers.py` — CRUD (no assignee endpoints); nested `/customers/{id}/interactions` deferred to Phase 05
- [x] Filters (q, status, owner_id, industry, min/max health), sort (whitelist dict, never f-string), pagination
- [x] CSM blocked from non-owned customer → 403; CSM supplying `owner_id` ≠ self → 403 (service); duplicate email → 409 (from IntegrityError)
- [x] **Test:** `test_rbac.py` (8 tests: csm read own/other, manager reads any, admin-vs-csm list counts, csm/admin delete, csm create with/without owner_id, csm/manager reassign owner) + `test_customers.py` (5 tests: dup-email create/update 409, pagination envelope across pages, q/status/health filters, invalid sort → 422). 27/27 backend tests pass (`pytest`); `ruff check .` clean; layering gate (`grep -rE "select\(|db\.query|session\.execute" app/api/`) empty. Verified live against seeded dev DB via curl (scoped list, 403, 422, 409, delete-403) — see chat log.
- [x] Found+fixed during implementation: `PageParams` as a `@dataclass` sub-dependency broke under this file's `from __future__ import annotations` (FastAPI double-wrapped the still-string annotation); switched to a plain class with `Query(default, ...)`-style defaults on `__init__`.

## Phase 05 — Interactions
- [x] `app/schemas/interaction.py` (create/update/out) + minimal `schemas/insight.py` `InsightOut` (id, status, error_message)
- [x] `app/repositories/interaction.py` — scope inherited via join + `apply_customer_scope` reused from Phase 04 (no reimplementation); filters customer_id/type/sentiment/date_from/date_to/q
- [x] `app/services/interaction_service.py` — view/create scoped via `CustomerService._assert_can_access`; update = author-or-admin/manager; delete = admin/manager only (route + service)
- [x] `create` inserts interaction **+ pending insight row in one transaction**, single commit, no LLM call (Phase 06 wires generation)
- [x] `app/api/v1/routers/interactions.py` — flat CRUD (`router`) + nested `customer_router` (`/customers/{id}/interactions`), both wired into `main.py`; no SQLAlchemy in the router
- [x] Access to interaction inherits customer scope for view/create; update/delete follow the separate author/role rule per the RBAC matrix (not customer ownership)
- [x] **Test:** `test_interactions.py` (9 tests: create on owned/non-owned, notes<20 chars→422, nested list scoped + 403, type/date-range filters, manager-deletes/csm-403, author-update-rule, manager-can-update-any). 36/36 backend tests pass; `ruff check .` clean; layering gate empty. Verified live against seeded dev DB (create→pending insight, nested list count, csm-delete-403, manager-delete-204).
  - *(Phase 06 note: the "pending insight" test above was renamed to `test_csm_creates_on_owned_customer_insight_row_exists` and now runs with `AI_ENABLED=False` monkeypatched, since Phase 06 made generation run inline before the response returns — the row is no longer observably `pending` from the API by the time the client sees it.)*

## Phase 06 — AI pipeline
- [x] `app/schemas/insight.py` — `InsightPayload` (sentiment normalized to positive/neutral/negative, unknown→neutral), full `InsightOut`
- [x] `app/llm/base.py` — `LLMProvider` protocol, `LLMResult`, `OpenAICompatibleProvider` (shared httpx call shape), typed errors (`LLMTimeoutError`/`LLMHTTPError`/`LLMAuthError`)
- [x] `app/llm/groq.py`, `app/llm/cerebras.py` — thin subclasses (base_url + name only); per-call timeout passed explicitly
- [x] `app/llm/client.py` — `FailoverLLMClient`: skips providers with empty key (never constructed), overall `LLM_TOTAL_BUDGET_SECONDS` deadline shared across every call incl. repairs, repair only if ≥8s remain, parse chain (`json.loads` → fenced extract → repair → next provider)
- [x] `app/llm/prompts.py` — system + user templates, notes truncated to 8000 chars
- [x] `app/services/insight_service.py` — **updates the existing pending row** (never creates one); `AI_ENABLED=false` → failed/"AI disabled"; regenerate resets to pending then re-runs generate
- [x] Wired into `interaction_service.create_interaction`: interaction+pending row already committed (Phase 05), generation runs after in a try/except that can never propagate to a 5xx
- [x] `POST /interactions/{id}/insight/regenerate` — same access rule as create/view (customer-scoped), not the author rule
- [x] Forced failure (real network call w/ invalid dummy keys, both providers) → status=failed (row exists, not null), 201 not 5xx — verified live
- [x] **Test:** `test_ai.py` (4 tests, provider boundary monkeypatched, no real HTTP call: Groq-fails→Cerebras-succeeds incl. sentiment case-normalization, both-fail→201/failed, unrecoverable-malformed-JSON→failed not 500, regenerate flips failed→completed). 40/40 backend tests pass; `ruff check .` clean; layering gate empty. Live-verified end-to-end against real Groq/Cerebras with intentionally-invalid dummy keys: 201, `insight.status=failed`, `error_message` set, `attempts` increments across regenerate calls, never a 500.

## Phase 07 — Dashboard + cache
- [x] `app/core/cache.py` — versioned key build (`scope_for`/`build_key`), `get_json`/`set_json` (custom encoder: Decimal→str, UUID→str, datetime/date→isoformat), `invalidate` (namespace-global INCR), fail-open via the existing Phase 03 `safe_*` wrappers
- [x] `app/repositories/dashboard.py` — `summary`/`sentiment_trend`/`at_risk`, all built on `apply_customer_scope` (Phase 04, reused directly — no reimplementation)
- [x] `app/services/dashboard_service.py` — cache-or-query orchestration, TTLs 120s/300s/120s
- [x] `app/api/v1/routers/dashboard.py` — `/summary`, `/sentiment-trend`, `/at-risk`, all `CurrentUser`-scoped (no role gate — scoping not role-gating, per the RBAC matrix)
- [x] Wired cache invalidation into customer/interaction/insight writes — `services/cache_hooks.py` stubs replaced with real `invalidate("customers"/"interactions"/"dashboard")`; zero changes needed to `customer_service.py`/`interaction_service.py`/`insight_service.py` since they already called the stub functions at every write site since Phase 04–06
- [x] Decimal/UUID/datetime JSON serialization for cache — custom `_CacheEncoder`, tested directly
- [x] **Found+fixed during implementation:** the version-key default-on-miss was originally `1` (matching what a first `INCR` on a missing key produces) — but that meant the *first-ever* `invalidate()` on a namespace nobody had read yet landed on the same version number a fresh read had already assumed, so the key didn't change and the cache silently kept serving pre-write data. Fixed by defaulting the miss-case to `0` instead (a real test caught this: `test_customer_write_invalidates_dashboard_cache` failed before the fix).
- [x] **Test:** `test_cache.py` (8 tests: encoder round-trip, version-bump changes the key, scope is in the key, cache-hit avoids a second repo call, customer-write invalidates the dashboard cache with fresh numbers, csm-scoped vs admin-global, Redis-down still 200, at-risk ordering). 48/48 backend tests pass; `ruff check .` clean; layering gate empty. Live-verified: miss→hit, write→fresh MISS (16→17 customers), admin(17) vs csm1(5) scope isolation, at-risk ascending health, sentiment-trend grouped by day, `docker compose stop redis` → dashboard still 200 with correct data.

## Phase 08 — Frontend foundation
- [ ] `create-next-app` (App Router, TS, Tailwind); confirm `next.config.js` rewrite + `output:'standalone'`
- [ ] `lib/axios.ts` — **baseURL='/api/v1' (relative), no withCredentials**, 15s global timeout, 45s override on create/regenerate, 60s on the mount-time refresh; interceptors + refresh-on-401 single-flight
- [ ] `store/` — configureStore, typed hooks, auth slice
- [ ] `store/slices/` skeletons with entities/ids + status/error
- [ ] Login + register pages (react-hook-form + zod)
- [ ] `components/AuthGuard` + silent refresh on mount + "Waking up the server…" banner after 3 s
- [ ] `app/(app)/profile/page.tsx` — view + edit name / change password (`PATCH /auth/me`)
- [ ] App shell / nav with role-aware links (Profile; Users only if Phase 10 optional page ships)
- [ ] Login persists across refresh via silent refresh

## Phase 09 — Frontend customers + interactions
- [ ] `zod` schemas mirroring backend
- [ ] customers slice (thunks) + list page (filters, pagination, sort)
- [ ] customer detail page (owner + interaction list) — no account-team UI
- [ ] create/edit customer form
- [ ] interactions slice (list/detail/create/update thunks) + create interaction form
- [ ] interactions list page with `InteractionFilters` (customer, type, date range, sentiment) + pagination
- [ ] interaction detail page (`/interactions/[id]`) — fields + InsightPanel slot + Edit (author/manager/admin)
- [ ] interaction edit page (`/interactions/[id]/edit`)
- [ ] role-gated action buttons

## Phase 10 — Frontend AI panel + dashboard
- [ ] Insight panel: summary, sentiment badge, action items, risks (states: pending/completed/failed)
- [ ] Failed-state panel + Retry (regenerate)
- [ ] dashboard slice + page: KPI cards
- [ ] Recharts: sentiment trend, at-risk list/chart
- [ ] Empty/loading/error states
- [ ] _(optional, cut #2)_ Users admin page + nav link

## Phase 11 — Docker
- [ ] `backend/Dockerfile` (slim, non-root, uvicorn, migrate-on-start entrypoint)
- [ ] `frontend/Dockerfile` (multi-stage, standalone output, **`ARG BACKEND_URL` in build stage**); `frontend/.dockerignore`
- [ ] Extend compose to run both apps; frontend `build.args.BACKEND_URL=http://backend:8000`; backend `COOKIE_SECURE=false`
- [ ] `docker compose up` → full stack reachable

## Phase 12 — Re-deploy + verify
- [ ] Confirm Neon/Upstash (provisioned in Phase 03); run any new migrations
- [ ] Redeploy complete backend to Render (`COOKIE_SAMESITE=lax`; CORS minimal, not load-bearing)
- [ ] Redeploy full frontend to Vercel; `BACKEND_URL` server-side env set
- [ ] Seed run against prod DB (locally, `DATABASE_URL` → Neon; Render free has no shell)
- [ ] Cookie confirmed first-party (Vercel origin, SameSite=Lax, no Domain)
- [ ] Both public URLs load and auth works across roles

## Phase 13 — README + demo + verification
- [ ] README: **demo credentials at the top** (3 roles) + "registration = empty csm" note
- [ ] README: setup, architecture, decisions (from master plan), env table (incl BACKEND_URL), run commands
- [ ] "What I'd build next" (Account Team) + namespace-global cache note + CSRF/role-from-DB/grace-window lines + "works without LLM keys" note
- [ ] Architecture diagram / description
- [ ] Demo video script (login per role, profile, customer CRUD, interaction list/filter/detail/edit, AI insight, failover, RBAC via owner reassign, dashboard, cache)
- [ ] Final pass: every module works on the live URLs
- [ ] Record + link video

---

## Deploy resolved (Phase 03) — notes for Phase 12 re-deploy
- **Live URLs:** backend `https://customer-success-platform-c2u0.onrender.com`, frontend `https://customer-success-platform-murex.vercel.app`.
- **Vercel + Next 16 gotcha:** Next 16.3.x Turbopack build omits `next-server.js.nft.json` → Vercel `onBuildComplete` ENOENT. Fix: `"build": "next build --webpack"` in `frontend/package.json`. Separately, the first Vercel project got stuck in a broken edge-routing state (build Ready but 404 on every route, even fresh deployments); **deleting and recreating the Vercel project fixed it**. Re-add env vars on any recreate — frontend needs only `BACKEND_URL` (server-side).
- **Prod seed:** run locally against Neon with the venv python (3.13): `DATABASE_URL=<neon> REDIS_URL=<upstash> JWT_SECRET=<secret> ENV=prod .venv/Scripts/python.exe scripts/seed.py`. Idempotent.
- **Secrets exposed in chat during setup** — rotate before any real use: Neon password, Upstash token, `JWT_SECRET`.

## Blocked / notes
- **Phase 03 deploy (Render + Neon + Upstash + Vercel) is code-complete but not executed.** No `vercel`/`render` CLI here and I can't create third-party accounts. Runbook (drive from your dashboards, paste only the resulting URLs back, never secrets):
  1. Push `main` to the existing `origin` (github.com/vishal-jadeja/customer-success-platform) — ask before I push.
  2. **Neon**: new project → copy the **pooled** connection string, append `?sslmode=require`, scheme `postgresql+psycopg2://`.
  3. **Upstash**: new Redis DB → copy the `rediss://` URL.
  4. **Render**: new Web Service, native Python, root dir `backend`, build `pip install .`, start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/healthz`. Env: `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `JWT_SECRET` (`python -c "import secrets;print(secrets.token_urlsafe(48))"`), `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `CORS_ORIGINS=<vercel-url-once-known>`, `ENV=prod`.
  5. **Vercel**: import repo, root dir `frontend`, env `BACKEND_URL=<render-url>` (server-side, NOT `NEXT_PUBLIC_`).
  6. Verify: `curl https://<render>/healthz` → `db/redis: ok`; open the Vercel URL, log in, DevTools confirms the `Set-Cookie` is on the Vercel host with `Secure; SameSite=Lax; Path=/api/v1/auth`, no `Domain`, and no request hits the Render domain.
  7. Optionally seed prod now: `DATABASE_URL=<neon-url> python scripts/seed.py` (run locally — Render free has no shell).
  Once URLs exist, tell me and I'll verify the round-trip and tick the three deploy items.
