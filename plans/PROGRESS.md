# PROGRESS

**Current phase:** 10 — DONE (code + `tsc --noEmit` + `next build` + full manual e2e via browser automation across admin/manager/csm roles, all verified locally; not yet redeployed to Vercel — Phase 12 handles re-deploy). Backend/frontend from Phase 03 still live on Render/Vercel. **Next: Phase 11 (Docker).**
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
- [x] `next.config.ts` rewrite + `output:'standalone'` gate carried from Phase 03 skeleton, untouched
- [x] `lib/axios.ts` — **baseURL='/api/v1' (relative), no withCredentials**, 15s global timeout (45s/60s overrides are plain per-call config, no special plumbing needed); request interceptor injects the in-memory token; response interceptor does single-flight refresh-on-401 via a dynamic `import("@/store")` (breaks the axios↔store circular import cleanly)
- [x] `store/` — `configureStore`, typed `useAppDispatch`/`useAppSelector`, `authSlice`
- [x] `authSlice`: `login`/`register`(→login, since the backend doesn't auto-login)/`refreshToken`/`fetchMe`/`updateMe`/`logout`, all funneled through `lib/errors.ts::extractApiError` so `action.payload` is always `{code,message}`
- [x] Login + register pages (react-hook-form + zod, `schemas/auth.ts` mirrors backend `LoginIn`/`RegisterIn`/`MeUpdateIn` incl. the password-pair validator)
- [x] `components/AuthGuard` — silent refresh on mount, `REFRESH_RACE` retried once after ~300ms, `WakingBanner` after 3s
- [x] `app/(app)/profile/page.tsx` — view email/role, edit full_name + optional password change; wrong current_password routes to that field from the 401 envelope
- [x] `components/AppShell` — Profile + Logout only this phase (Customers/Interactions/Dashboard pages don't exist until Phase 09/10; linking to them now would be exactly the dead link the plan warns against for the optional Users page)
- [x] Login persists across hard refresh via silent refresh — live-verified via browser automation
- [x] **Verification:** `next build` clean (5 routes generated); `tsc --noEmit` clean; full manual e2e via Chrome automation — register→auto-login→landed on `/`, no app token in localStorage/sessionStorage, hard reload still authenticated with exactly one `/auth/refresh` call (network-tab confirmed), profile name-change updates the header instantly with no reload, wrong current_password → inline field error not a crash, wrong login password → inline error, logout → redirect to `/login`, hitting `/profile` post-logout bounces back to `/login`. `npm run lint` is broken pre-existing (ESLint 9.39.5 + eslint-config-next 16.3.3 FlatCompat circular-JSON crash on config load, confirmed present before this session's changes) — not a Phase 08 regression; `next build` (what Vercel actually runs) is unaffected and is the meaningful gate.

## Phase 09 — Frontend customers + interactions
- [x] `zod` schemas mirroring backend (`schemas/customer.ts`, `schemas/interaction.ts`) — both export the raw pre-coercion input type alongside the parsed output type (`z.input`/`z.infer`), needed because `health_score`/`duration_minutes` use `z.coerce`/`z.preprocess` and RHF 7's resolver typing requires the two to be threaded through `useForm<Raw, unknown, Parsed>` separately, or `tsc` fails
- [x] `customersSlice` (fetchCustomers/fetchCustomer/create/update/delete, normalised entities/ids, `filters` mirrors last query) + list page (filter bar: q/status/industry/health range/sort/order, pagination, row click → detail)
- [x] customer detail page (owner + nested interaction list via `fetchForCustomer`) — no account-team UI; inline "You don't have access" on 403 instead of a crash
- [x] create/edit `CustomerForm` — owner selector (plain `GET /users` fetch, not a slice — the dropdown is the only Phase 09 consumer) shown only to admin/manager; 409 → email field error, 422 → field errors via `fieldErrorsFromDetails` (new helper in `lib/errors.ts`, maps FastAPI's `{loc,msg,type}` details to `{field: message}`)
- [x] `interactionsSlice` (fetchInteractions/fetchForCustomer/fetchInteraction/create/update thunks) + `InteractionForm` (customer fixed+read-only when preselected via `?customer_id=` or when editing — backend `InteractionUpdate` has no customer_id field; otherwise a selectable dropdown)
- [x] interactions list page with `InteractionFilters` (customer, type, sentiment, date range) + pagination — mirrors backend query params exactly (`q` intentionally left out per the phase file's filter list)
- [x] interaction detail page (`/interactions/[id]`) — fields + minimal inline insight panel slot (pending/completed/failed states) — full InsightPanel + Retry lands in Phase 10; Edit gated to admin/manager/author (`interaction.user_id === user.id`)
- [x] interaction edit page — editing notes does NOT re-trigger regeneration (no regenerate call wired this phase, matches the plan's explicit note)
- [x] role-gated action buttons: `RoleGate` (common/RoleGate.tsx) for pure role checks; ownership/author checks done inline in the customer/interaction detail pages since RoleGate only knows roles
- [x] **Verification:** `tsc --noEmit` clean, `next build` clean (13 routes). Full manual e2e via Chrome automation across **admin** and **csm1**: customer list scoped correctly (17 total for admin vs 5 owned for csm1), filter+sort+pagination issue correct params (verified sentiment=negative filter), customer/interaction detail pages render all fields incl. owner and nested/insight data, edit interaction saves and redirects, create customer with a duplicate email → inline email field error (not a toast), create with a unique email succeeds and redirects to detail, csm create omits the owner selector and the created customer is self-owned, csm direct-nav to a non-owned customer id → inline "You don't have access" (no crash), csm viewing a manager-authored interaction on an owned customer sees no Edit link (author rule, not ownership — confirmed via a direct DB-backed lookup of a manager-authored row on a csm-owned customer), create-interaction → inline notes<20-chars zod error blocks submit client-side, then a valid submission runs the live AI pipeline end-to-end (Groq) and lands on the detail page with a real insight.

## Phase 10 — Frontend AI panel + dashboard
- [x] `lib/colors.ts` (single sentiment/status→colour map, Tailwind classes + Recharts hex) + `lib/format.ts` (currency/count/health formatters) + `components/insights/SentimentBadge.tsx` — replaces the three independent `SENTIMENT_STYLES`/`STATUS_STYLES` copies that had accumulated across Phase 09 (interaction detail inline block, `InteractionList`, `CustomerTable`, customer detail page)
- [x] `interactionsSlice`: `regenerateInsight` thunk (`POST /interactions/{id}/insight/regenerate`, 45s per-request timeout override — axios's global 15s timeout is shorter than the backend's 35s `LLM_TOTAL_BUDGET_SECONDS`, a latent bug also fixed on `createInteraction` since it runs the same inline AI pipeline) + per-id `regeneratingIds`/`regenerateErrors` (not a global flag, so one row regenerating never disables a sibling's Retry)
- [x] `components/insights/InsightPanel.tsx` — one component, two chrome variants (`full`/`compact`): completed (summary + `SentimentBadge` + action items + risks, empty lists render "No action items suggested." rather than vanishing) / failed (red block, real `error_message`, Retry) / pending / null-as-pending. A fulfilled regenerate with `insight.status==="failed"` is handled as a normal state flip, not an error — the endpoint returns 200 even when generation itself fails (confirmed in `InsightService`)
- [x] Wired into `/interactions/[id]` (full, replacing the Phase 09 inline block) and `InteractionList` via a new `expandableInsights?` prop (default `false`, so `/interactions` is unchanged) used only from `/customers/[id]` — each row gets a toggle revealing a compact panel; a `failed` row starts expanded by default so a failure is never hidden
- [x] `dashboardSlice` — three independent sections (`summary`/`trend`/`atRisk`), each with its own `status`/`error` so one endpoint failing never blanks the others; thunks return bare arrays/objects (`GET /dashboard/sentiment-trend` and `/at-risk` are NOT `Page<T>` envelopes, unlike every other list endpoint in this app)
- [x] `components/dashboard/{DashboardSection,KpiCards,SentimentTrendChart,AtRiskList}.tsx` + `app/(app)/dashboard/page.tsx` — 5 KPI tiles (customers/ARR/avg health/at-risk/interactions-30d) + sentiment-breakdown strip, Recharts `LineChart` (installed `recharts@^3.10.1` — 2.x lacks a React 19 peer range, this repo pins `react@19.2.8` exact), lowest-health list labelled accurately (`GET /dashboard/at-risk` orders by `health_score ASC` with **no status filter** — confirmed live: churned/at_risk/onboarding customers all appear)
- [x] `lib/trend.ts::buildTrendSeries` — gap-fills the sparse trend response (only days with a non-null-sentiment insight are returned, no zero-filled gaps) into a continuous UTC-bucketed series, union'd with the response's own keys so a boundary-day point from the backend's `>= now - timedelta(days)` filter can never be silently dropped
- [x] `app/(app)/page.tsx` → server-component `redirect("/dashboard")` (prerenders static, confirmed in the build's route list); `AppShell` gets a `Dashboard` nav link first
- [x] **Optional Users admin page shipped** (schedule hasn't slipped — master plan's cut order is conditional, not automatic): `usersSlice` (`fetchUsers`/`updateUser`/`deactivateUser`, `Page<User>` envelope unlike the dashboard endpoints, per-id `mutatingIds`/`mutationErrors`) + `app/(app)/users/page.tsx` — admin gets a role `<select>` + Deactivate (soft delete, row stays greyed not removed) behind `RoleGate(["admin"])`; manager sees the same table read-only; nav link behind `RoleGate(["admin","manager"])`. Backend's 409 on self-demote/self-deactivate (`UserService`) surfaces inline, not swallowed.
- [x] **Verification:** `npx tsc --noEmit` clean, `next build --webpack` clean (15 routes, `/` now static-prerendered as a redirect). `npm run lint` still hits the pre-existing ESLint9/eslint-config-next circular-JSON crash (confirmed present before Phase 10, same as Phase 08/09 — not a regression). Full manual e2e via Chrome automation:
  - Full InsightPanel: existing completed insight renders all 4 sections + provenance footer (`groq · openai/gpt-oss-120b · 1203 ms · attempt 1`); Retry on a completed insight re-runs live (exactly one `POST .../regenerate`, no follow-up `GET` — confirmed via network-request inspection) and updates in place with a new `attempts` count; a seed-data **failed** insight ("All LLM providers failed or timed out") shows the failed state + Retry, and clicking Retry flips it to completed live without reload — the full failed→retry→completed acceptance criterion.
  - Compact panels: customer detail page's interaction rows toggle open/closed; failed rows start pre-expanded; row-click-to-navigate still works alongside the toggle (`stopPropagation` confirmed).
  - Dashboard as admin: 19 customers, $1,530,000 ARR (currency-formatted, not a raw Decimal string), avg health 56, at-risk 3/19, 18 interactions/30d, sentiment strip, a full 30-day continuous chart (07-29 → 08-25) with correct gap-filled zeros between real data points, lowest-health list mixing churned/at_risk/onboarding statuses as designed.
  - Dashboard as csm1: every number smaller than admin's (6 customers vs 19), lowest-health list scoped to only csm1-owned customers, trend chart scoped to csm1's own insights.
  - Empty state: registered a brand-new csm with zero customers → `0`/`$0`/`—`/`0`/`0` KPIs, trend section shows "No sentiment data in the last 30 days...", at-risk section shows "No customers in your book yet." (not a flat zero line or a blank crash).
  - Independent failure/recovery: killed the backend process outright and confirmed a clean recovery on restart (silent refresh re-authenticated, dashboard re-rendered correctly) — a full backend outage blanks the page via the pre-existing `AuthGuard` (expected, unrelated to Phase 10: auth itself needs the backend), so true per-section isolation among the three dashboard thunks rests on the code's structural guarantee (three fully independent `status`/`error` pairs in `dashboardSlice`, verified by each section rendering correctly from its own successful fetch) rather than a live simulated partial outage.
  - Users page: admin sees all 7 users, role `<select>` change (`csm`→`manager`) persisted across reload then reverted; self-deactivate on the admin's own row surfaced the backend's exact 409 message ("You cannot deactivate yourself") inline, no crash; manager sees the link + table with plain-text roles, no select/button; csm has no Users nav link and direct-navigating to `/users` shows the 403 envelope message inline ("Role 'csm' may not GET /api/v1/users"), no crash.

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
