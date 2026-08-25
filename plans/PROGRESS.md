# PROGRESS

**Current phase:** 01 follow-up (senior review) → then 02 — Models, migration, seed
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
- [ ] `app/db.py` — engine (`pool_size=5, max_overflow=5`), `SessionLocal`, `get_db` dependency
- [ ] `app/models/` — user, refresh_token, customer, interaction, insight (no customer_assignment)
- [ ] Python enums shared with DB enums (no AccountRole)
- [ ] `alembic init`, configure `env.py` to import Base + read `DATABASE_URL`
- [ ] Generate + hand-verify initial migration (enums have `CREATE TYPE`); `customers.owner_id` ON DELETE RESTRICT
- [ ] `alembic upgrade head` succeeds; downgrade/upgrade round-trip clean
- [ ] `scripts/seed.py` — users (all roles), customers across owners, interactions, insights `status=completed` `provider='seed'` `latency_ms=NULL`, written directly
- [ ] Seed runs idempotently

## Phase 03 — Auth + RBAC + errors + logging + first deploy
- [ ] `app/core/security.py` — hash/verify password (**bcrypt directly, no passlib**), encode/decode JWT
- [ ] `app/core/exceptions.py` — AppError hierarchy
- [ ] `app/core/errors.py` — exception handlers → JSON envelope; `IntegrityError`→409 (unique email + ON DELETE RESTRICT)
- [ ] `app/core/logging.py` — request-id contextvar + filter + structured formatter
- [ ] `app/core/middleware.py` — request-id middleware
- [ ] `app/core/ratelimit.py` — slowapi Limiter keyed on `X-Forwarded-For` first hop, `enabled=RATE_LIMIT_ENABLED`; `10/minute` on `POST /auth/login`
- [ ] `app/core/redis.py` — client + fail-open wrapper
- [ ] `app/repositories/user.py`, `refresh_token.py`
- [ ] `app/services/auth_service.py` — register, login, refresh (rotation + reuse detection with 10 s grace window), logout
- [ ] `tests/conftest.py` — test DB (`csp_test`, alembic once, per-test rollback, `get_db` override), fakeredis, rate-limit off, role fixtures + `token_for`
- [ ] `app/core/deps.py` — `get_current_user`, `require_roles`
- [ ] `app/api/v1/routers/auth.py`
- [ ] Cookie set/clear helpers (httpOnly, Secure, **SameSite=Lax, no Domain**, Path=/api/v1/auth)
- [ ] Register→login→me→refresh→logout works via curl
- [ ] **Test:** reuse of revoked refresh token → family revoked, 401 (`test_auth.py`)
- [ ] **Deploy:** skeleton backend on Render (native Python runtime) + Neon + Upstash; `/healthz` green on Render URL
- [ ] **Deploy:** minimal Next.js on Vercel with `next.config.js` proxy rewrite + `BACKEND_URL`
- [ ] **Deploy:** one login round-trip verified against the deployed URLs (first-party cookie)

## Phase 04 — Customers
- [ ] `app/schemas/customer.py` — create/update/read/list
- [ ] `app/repositories/customer.py` — `apply_customer_scope` (owner_id==self), list/get/create/update/delete; catch `IntegrityError`→ConflictError (no pre-check)
- [ ] `app/services/customer_service.py` — `_assert_can_access` (own = owner_id==self)
- [ ] `app/api/v1/routers/customers.py` — CRUD (no assignee endpoints)
- [ ] Filters (q, status, owner_id, industry, health range), sort, pagination
- [ ] CSM blocked from non-owned customer → 403; CSM supplying `owner_id` ≠ self → 403 (service); duplicate email → 409 (from IntegrityError)
- [ ] **Test:** csm cannot read another csm's customer (`test_rbac.py`)

## Phase 05 — Interactions
- [ ] `app/schemas/interaction.py` + minimal `schemas/insight.py` `InsightOut` (id, status, error_message)
- [ ] `app/repositories/interaction.py` — scope via parent customer
- [ ] `app/services/interaction_service.py`
- [ ] `create` inserts interaction **+ pending insight row in one transaction** (no LLM here)
- [ ] `app/api/v1/routers/interactions.py` — CRUD, nested list, filters
- [ ] Access to interaction inherits customer scope

## Phase 06 — AI pipeline
- [ ] `app/schemas/insight.py` — `InsightPayload`, read schema
- [ ] `app/llm/base.py` — `LLMProvider` protocol, `LLMResult`
- [ ] `app/llm/groq.py`, `app/llm/cerebras.py` (per-provider 15s timeout)
- [ ] `app/llm/client.py` — `FailoverLLMClient`, skips providers with empty key, overall `LLM_TOTAL_BUDGET_SECONDS` deadline (repair only if ≥8 s left), parse chain, repair call
- [ ] `app/llm/prompts.py` — system + user templates
- [ ] `app/services/insight_service.py` — **update the existing pending row** (not create); regenerate resets to pending
- [ ] Wire into `POST /interactions` (row already committed in Phase 05; generate after)
- [ ] `/interactions/{id}/insight/regenerate`
- [ ] Forced failure → status=failed (row exists, not null), 201 not 5xx
- [ ] **Test:** failover Groq→Cerebras + malformed-JSON repair → failed, no 500 (`test_ai.py`)

## Phase 07 — Dashboard + cache
- [ ] `app/core/cache.py` — versioned key build, get/set-json, invalidate (namespace-global), fail-open
- [ ] `app/repositories/dashboard.py` — summary/trend/at-risk queries (scoped)
- [ ] `app/services/dashboard_service.py` — cache orchestration
- [ ] `app/api/v1/routers/dashboard.py`
- [ ] Wire cache invalidation into customer/interaction/insight writes
- [ ] Decimal/UUID/datetime JSON serialization for cache
- [ ] **Test:** cache miss→hit; write bumps version→next read misses (`test_cache.py`)

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

## Blocked / notes
- _(none yet)_
