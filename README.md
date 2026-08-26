# Customer Success Platform

AI-powered Customer Success Platform: manage customers and interactions, generate
structured AI insights from meeting notes, and view operational metrics on a role-scoped
dashboard. Three roles — `admin`, `manager`, `csm` — with two-level RBAC enforcement.

## Demo credentials

Log in with one of these seeded accounts to see populated data:

| Role | Email | Password |
|---|---|---|
| admin | `admin@csp.demo` | `Admin123!` |
| manager | `manager1@csp.demo` | `Manager123!` |
| csm | `csm1@csp.demo` | `Csm12345!` |

> Registering a new account creates an empty `csm` account by design — use the demo logins
> above to see populated data, or explore an empty book from a fresh registration.

## Live URLs

| | URL |
|---|---|
| Frontend | https://csp.vishaljadeja.xyz |
| Frontend (Vercel) | https://customer-success-platform-murex.vercel.app |
| Backend API | https://customer-success-platform-c2u0.onrender.com |
| Backend docs | https://customer-success-platform-c2u0.onrender.com/docs |
| Health check | https://customer-success-platform-c2u0.onrender.com/healthz |

**Cold start:** the backend is on Render's free tier and sleeps after inactivity. The first
request after a period of idleness takes up to ~45s to wake up; hit `/healthz` first if you
want the frontend's first load to feel instant. Once warm it responds immediately.

Demo video: _(link to be added)_.

---

## Quick start (Docker Compose)

```bash
git clone https://github.com/vishal-jadeja/customer-success-platform.git
cd customer-success-platform
cp backend/.env.example backend/.env      # fill in JWT_SECRET at minimum
cp frontend/.env.example frontend/.env    # defaults already point at the compose backend
docker compose up -d
docker compose exec backend python scripts/seed.py   # 6 users, 15 customers, interactions + insights
```

Open http://localhost:3000 and log in with any demo credential above. The app works with
**no LLM keys set** — insights are then stored as `status=failed`,
`error_message="no LLM provider configured"`, so the app boots and every other module is
still gradeable. Set `GROQ_API_KEY` and/or `CEREBRAS_API_KEY` in `backend/.env` (then
`docker compose restart backend`) for real AI generation.

### Quick start (local, no Docker)

```bash
docker compose up -d postgres redis      # just the two dependencies

cd backend
cp .env.example .env                      # DATABASE_URL/REDIS_URL already point at localhost
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000

cd ../frontend
cp .env.example .env                      # BACKEND_URL=http://localhost:8000
npm install
npm run dev
```

---

## Environment variables

All variables live in `backend/.env.example` (backend + Docker Compose) and
`frontend/.env.example` (frontend build). Nothing is duplicated between them.

### Backend (`backend/.env.example`)

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (sync psycopg2) | `postgresql+psycopg2://csp:csp@localhost:5432/csp` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `JWT_SECRET` | HS256 signing secret for access tokens | 32+ random bytes |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_TTL_MIN` | Access token lifetime | `15` |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime | `7` |
| `REFRESH_REUSE_GRACE_SECONDS` | Window in which a repeated refresh presentation is treated as a benign multi-tab race, not theft | `10` |
| `RATE_LIMIT_ENABLED` | Toggles the login rate limiter (off under pytest) | `true` |
| `CORS_ORIGINS` | Comma-separated allow-list; not load-bearing behind the reverse proxy — only lets `/docs` be opened directly | `http://localhost:3000` |
| `COOKIE_SECURE` | `Secure` flag on the refresh cookie — `false` locally (Safari rejects `Secure` over `http`), `true` in prod | `false` |
| `COOKIE_SAMESITE` | `SameSite` attribute on the refresh cookie | `lax` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Primary LLM provider — **optional** | `openai/gpt-oss-120b` |
| `CEREBRAS_API_KEY` / `CEREBRAS_MODEL` | Failover LLM provider — **optional** | `gpt-oss-120b` |
| `LLM_PROVIDER_ORDER` | Failover order | `groq,cerebras` |
| `LLM_TIMEOUT_SECONDS` | Per-HTTP-call timeout | `15` |
| `LLM_TOTAL_BUDGET_SECONDS` | Overall deadline per insight, across every provider + repair call | `35` |
| `AI_ENABLED` | Kill switch — `false` skips generation entirely, insight goes straight to `failed` | `true` |
| `ENV` | `dev` / `prod` | `dev` |
| `TEST_DATABASE_URL` | Optional override for the pytest DB | `postgresql+psycopg2://csp:csp@localhost:5432/csp_test` |

### Frontend (`frontend/.env.example`)

| Variable | Purpose | Example |
|---|---|---|
| `BACKEND_URL` | **Server-side, build-time only** — resolves the Next.js rewrite for `/api/v1/*`. Deliberately **not** `NEXT_PUBLIC_`: the Render URL must never reach the browser bundle. There is no public API-URL variable — axios always uses a relative `baseURL: '/api/v1'`. Because `next build` bakes rewrites into the build output, this must be set *before* the build runs (Vercel dashboard env, or a Docker `ARG`), not at container start. | `http://localhost:8000` (local) · `http://backend:8000` (compose) · `https://customer-success-platform-c2u0.onrender.com` (Vercel) |

---

## Architecture

### Layering (enforced)

```
app/api/v1/routers/*.py   HTTP only — parse request, call service, return schema
app/services/*.py         business rules, ownership checks, cache orchestration, transactions
app/repositories/*.py     ALL SQLAlchemy queries — and only here
app/models/*.py           ORM models
app/schemas/*.py          Pydantic v2, one per direction
app/core/*.py             config, security, logging, exceptions, redis, deps
app/llm/*.py              provider protocol + Groq/Cerebras + failover client
```

A CI-style gate keeps this honest: `grep -rE "select\(|db\.query|session\.execute" app/api/`
must return nothing — every query lives in a repository, never a router.

### Data model (ERD summary)

- **users** — `id, email (unique), hashed_password (bcrypt), full_name, role (admin|manager|csm), is_active, created_at, updated_at`
- **refresh_tokens** — `id, user_id → users, token_hash (SHA-256, raw token never stored), expires_at, revoked_at, created_at`
- **customers** — `id, name, company, email (unique), phone, industry, status (onboarding|active|at_risk|churned), health_score (0–100), arr, owner_id → users (ON DELETE RESTRICT), created_at, updated_at`
- **interactions** — `id, customer_id → customers (CASCADE), user_id → users (RESTRICT), type (meeting|call|email|support_ticket|qbr), title, notes (≥20 chars, AI input), occurred_at, duration_minutes, created_at, updated_at`
- **insights** — 1:1 with interactions — `id, interaction_id → interactions (unique, CASCADE), status (pending|completed|failed), summary, sentiment (positive|neutral|negative), action_items (JSONB), risks (JSONB), raw_response, error_message, provider, model, latency_ms, attempts, created_at, updated_at`

Single-tenant, ownership-based scoping: `customers.owner_id` is the only accountability
model (no `organizations` table — see "What I'd build next" below).

### RBAC — two levels, enforced independently

| Action | admin | manager | csm |
|---|---|---|---|
| List / view customers | all | all | own only |
| Create customer | any owner | any owner | forced self-owned |
| Update customer | any | any | own only |
| Reassign owner | ✅ | ✅ | ❌ 403 |
| Delete customer | ✅ | ❌ | ❌ |
| List / view interactions | all | all | on own customers |
| Create interaction | any customer | any customer | own customers |
| Update interaction | any | any | own-authored |
| Delete interaction | ✅ | ✅ | ❌ |
| Regenerate insight | ✅ | ✅ | own customers |
| Dashboard | global | global | own book |
| List users | ✅ | ✅ read-only | ❌ |
| Create/modify users | ✅ | ❌ | ❌ |

Every route carries a `Depends(require_roles(...))` verb gate **and** every service call does
a row-level `_assert_can_access(obj, user)` ownership check. Role-gating in the UI
(`RoleGate`, nav links) is UX convenience only — it is never the only thing standing between
a request and the data; direct API calls hit the same two checks.

```python
def apply_customer_scope(stmt, user):
    if user.role in (Role.admin, Role.manager):
        return stmt
    return stmt.where(Customer.owner_id == user.id)
```

### Auth — access in memory, refresh in a first-party httpOnly cookie

Access tokens are short-lived (15 min) and held only in Redux memory, never `localStorage` —
an XSS payload can't walk off with a long-lived credential. The refresh token lives in an
httpOnly + `Secure` + `SameSite=Lax` cookie JS can't touch. The frontend never calls the
backend cross-origin: a **Next.js reverse proxy** rewrites `/api/v1/*` to the backend server
-to-server, so from the browser's view the cookie is first-party to the frontend's own
origin. This sidesteps Safari ITP / Chrome third-party-cookie behavior entirely, and the
Render URL never reaches the client.

Every refresh **rotates** the token; presenting an already-revoked token triggers
family-wide revocation — standard defense against refresh-token theft — except inside a 10s
grace window, which absorbs the benign case of two tabs refreshing at once. Because the
cookie is `SameSite=Lax`, a cross-site page can't make the browser send it on a POST, so
`/auth/refresh` is CSRF-safe with no separate CSRF token. The access token's `role` claim is
only a hint — every request re-loads the user from the DB, so a role change or deactivation
takes effect immediately rather than at token expiry.

### Caching — version-key namespace, not KEYS/SCAN

Redis caches the three dashboard reads (summary, sentiment-trend, at-risk).

```
version key: csp:ver:{ns}                                     integer counter
cache key:   csp:{ns}:{op}:v{version}:{scope}:{sha1(params)}
```

Read: `GET` version (missing → treated as `0`) → build key → `GET` → hit deserialize / miss
query + `SETEX`. Invalidate: `INCR csp:ver:{ns}` — O(1) atomic, old keys unreachable,
expiring naturally on TTL. `KEYS` is O(N) and blocks Redis's single thread; `SCAN` is
non-atomic across multiple round-trips with a stale-read window; `INCR` is O(1), atomic, and
always correct — the cost is that orphaned keys linger until TTL, which is bounded and
acceptable at this scale.

**Named limitation:** invalidation is namespace-global, not per-scope — one CSM's write
bumps every user's cached dashboard in that namespace. That's coarse-grained but always
correct (never stale); per-scope version counters would be the move if write volume grew.

Scope is baked into the key: `csm-{user_id}` for a CSM, `role-{role}` for admin/manager
(shared, since they see the same global data) — a missing scope would leak one CSM's book
into another's cache. TTLs: summary 120s · at-risk 120s · sentiment-trend 300s.
`customers`/`interactions` namespace counters exist and are bumped on every write (ready for
a cached list endpoint later) but nothing reads them today — only the dashboard is cached.

**Fail-open:** any `redis.RedisError` is caught, logged with the request id, and the code
falls through to Postgres. Redis being down means slower responses, never a 500 and never
stale data.

### AI pipeline — inline, but resilient

`LLMProvider` protocol → `GroqProvider`, `CerebrasProvider` → `FailoverLLMClient`, ordered
by `LLM_PROVIDER_ORDER`. One OpenAI-compatible HTTP call shape; only base URL / key / model
differ. `response_format=json_object`, `temperature=0.2`, notes truncated to 8000 chars.

Parse chain: `json.loads` → fenced-code-block extraction + retry → one repair call to the
same provider (only if ≥8s remain in the shared budget) → give up and try the next provider.
Output is validated against an `InsightPayload` Pydantic model; sentiment is lower-cased,
an unrecognized value maps to `neutral`.

**The interaction and a `status='pending'` insight row are committed together, in one
transaction, before the LLM is ever called.** The LLM call then updates that same row to
`completed`/`failed` in a second commit. This means AI failure can never block or roll back
the write: `POST /interactions` always returns **201**, and only the insight's own `status`
field can be `failed`. Because the row is committed up front, `pending` is a real observed
state and "regenerate" always has a genuine row to act on — never null. The frontend shows
a "Generation failed — Retry" panel wired straight to the regenerate endpoint.

| Failure | Behavior |
|---|---|
| Timeout | log with request id + provider, try next provider |
| 429 / 5xx | log, try next provider |
| 401 / 403 | log (bad creds), try next provider, never retried on the same one |
| Malformed JSON | fenced-block extraction → repair call → give up |
| Schema validation failure | repair call → give up |
| All providers exhausted | `status=failed`, `error_message` set, `raw_response` = last body, `attempts` incremented |
| `AI_ENABLED=false` | skipped entirely, `status=failed`, `error_message="AI disabled"` |

### Dashboard

Five KPI tiles (customers, total ARR, average health, at-risk count, interactions in the
last 30 days), a sentiment breakdown strip across every insight, a 30-day sentiment trend
line chart (the backend returns only days that actually had an insight; the frontend
gap-fills the missing days into a continuous UTC-bucketed series), and a lowest-health list
ordered purely by `health_score` with **no status filter** — deliberate, so churned,
at-risk, and onboarding customers can all surface together as risk signals, not just one
status bucket. Every number is scoped the same way customer/interaction lists are: global
for admin/manager, own book for a csm.

### Error envelope

Every error — validation, auth, permission, conflict, upstream LLM failure, or an unhandled
exception — comes back in one shape:

```json
{ "error": { "code": "PERMISSION_DENIED", "message": "...", "details": null, "request_id": "..." } }
```

| Exception | HTTP | code |
|---|---|---|
| Not found | 404 | `NOT_FOUND` |
| Permission denied | 403 | `PERMISSION_DENIED` |
| App / request validation | 422 | `VALIDATION_ERROR` |
| Conflict (unique email, `ON DELETE RESTRICT`) | 409 | `CONFLICT` |
| Auth failure | 401 | `UNAUTHORIZED` |
| Refresh reused inside the grace window | 401 | `REFRESH_RACE` — client retries once, family not revoked |
| Upstream LLM failure | 502 | `EXTERNAL_SERVICE_ERROR` |
| Unhandled | 500 | `INTERNAL_ERROR` — generic message, traceback logged only |

A request-id middleware reads `X-Request-ID` or generates a uuid4, threads it through a
contextvar into every log line, and echoes it on the response header and inside every error
body — so a grader (or you) can correlate a client-visible failure with the exact server log
line that produced it.

---

## API surface

Prefix `/api/v1`. Auth column: `–` public · `A` access token (bearer) · `C` refresh cookie.

| Method | Path | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | – | – | Signup. Role forced to `csm`. |
| POST | `/auth/login` | – | – | Access token + user; sets refresh cookie. Rate-limited 10/min per client IP. |
| POST | `/auth/refresh` | C | – | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | C | – | Revoke + clear cookie, 204 |
| GET | `/auth/me` | A | any | Profile |
| PATCH | `/auth/me` | A | any | Update name / password |
| GET | `/users` | A | admin, manager | Paginated users |
| POST | `/users` | A | admin | Create user, any role |
| PATCH | `/users/{id}` | A | admin | Change role / deactivate |
| DELETE | `/users/{id}` | A | admin | Soft delete (`is_active=false`) |
| GET | `/customers` | A | scoped | List — filters, sort, pagination |
| POST | `/customers` | A | any | Create — csm: `owner_id` forced to self; other `owner_id` → 403 |
| GET | `/customers/{id}` | A | scoped | Detail + interaction count |
| PATCH | `/customers/{id}` | A | admin/manager/owner-csm | Update |
| DELETE | `/customers/{id}` | A | admin | Hard delete, cascades to interactions |
| GET | `/customers/{id}/interactions` | A | scoped | Nested interaction list |
| GET | `/interactions` | A | scoped | List — filters, pagination |
| POST | `/interactions` | A | scoped | Create + inline AI generation |
| GET | `/interactions/{id}` | A | scoped | Detail, including insight |
| PATCH | `/interactions/{id}` | A | admin/manager/author | Update |
| DELETE | `/interactions/{id}` | A | admin, manager | Delete |
| POST | `/interactions/{id}/insight/regenerate` | A | admin/manager/owner-csm | Retry insight generation |
| GET | `/dashboard/summary` | A | scoped | KPI cards — cached |
| GET | `/dashboard/sentiment-trend` | A | scoped | `?days=30` — cached |
| GET | `/dashboard/at-risk` | A | scoped | Lowest-health list — cached |
| GET | `/healthz` | – | – | DB `SELECT 1` + Redis `PING` |

List responses use one envelope: `{ items, total, page, page_size, total_pages }`.
Full interactive docs (request/response schemas) are live at `/docs` on the backend URL
above.

---

## Design decisions & trade-offs

**Auth — access in memory, refresh in a first-party httpOnly cookie, with rotation + reuse
detection.** See "Auth" above for the full reasoning. Highlight: the reverse-proxy design
makes a cross-site `SameSite=None` cookie unnecessary, sidestepping a class of bugs that
work on `localhost` and silently fail once frontend and backend sit on different public
domains.

**RBAC — two levels.** A role dependency on the route gates the verb; a service-layer
ownership check gates the row. Route-only would let a csm edit another csm's customer;
service-only would lose the self-documenting route contract. Scope is a single function
(`apply_customer_scope`) reused by both customers and — via a join — interactions.

**Sync SQLAlchemy over async.** A deliberate reliability choice under time pressure. FastAPI
runs sync DB calls in a threadpool, so throughput is fine at this scale and the code is
simpler to get right the first time.

**Caching — version-key namespace, not KEYS/SCAN.** Invalidation is a single atomic `INCR`
on a namespace counter embedded in every cache key, rather than a pattern scan. Trade-off:
orphaned keys linger until TTL — bounded and acceptable. Invalidation is namespace-global:
one user's write bumps the whole namespace's version, invalidating every user's cached list
in that namespace at once. That's coarse-grained but always correct, and right for this
scale; per-scope version counters would be the move if write volume grew. The cache itself
is fail-open — Redis down degrades speed, never correctness.

**AI — inline, but resilient.** Insight generation runs inside the create request (Groq is
fast). The interaction and a `pending` insight row are committed together *before* the LLM
call, so AI failure never blocks or rolls back the write; the LLM result then updates that
row to `completed`/`failed` in a second commit, and the endpoint always returns 201 with the
insight attached (`status='failed'` on total failure), with the UI offering a retry. Groq is
primary with automatic Cerebras failover; responses are parsed defensively (fenced-block
extraction → one repair call) and the raw model output, status, provider, and error are all
persisted for debuggability.

**Testing — thin critical-path pytest, no frontend tests.** Under a one-day build budget,
backend tests cover the highest-risk logic (refresh rotation/reuse, RBAC denial, AI failover
+ malformed-JSON repair, cache invalidation) and are written in-context at the end of the
phase that produces the code, not batched into a separate late phase. Frontend tests were
consciously descoped; client-side validation mirrors the backend's Pydantic schemas
(zod ↔ Pydantic) field-for-field, so the same rules apply regardless of which side a request
comes from.

### Honest scope notes

- The app **boots and runs with no LLM keys set** — insights simply come back
  `status=failed`, `error_message="no LLM provider configured"`, so every other module stays
  fully gradeable without any credentials.
- Cerebras is wired, configured, and code-complete as the failover provider, but its account
  currently sits on a billing hold in production (`402`). Failover has been demonstrated for
  real by breaking both keys locally, not by an organic failure in prod — the demo video
  says this explicitly rather than implying otherwise.
- Redis caching covers the three dashboard reads. The `customers` and `interactions` cache
  namespaces exist and are correctly bumped on every write, but nothing reads through them
  yet — those list/detail endpoints hit Postgres directly on every request.
- Frontend automated tests are out of scope by design (see Testing above); validation
  parity is the compensating control.

### What I'd build next — Account Team access

Real CS teams need more than one accountable owner: a solutions architect, an exec sponsor,
and a backup csm all legitimately need access to an account they don't "own." A single
`owner_id` can't express that — it collapses accountability and access into one column. The
industry answer is Salesforce's `OwnerId` (one accountable owner) **+** `AccountTeamMember`
(many members, each with a descriptive role and access level) — the pattern HubSpot and
Gainsight also ship. It's deliberately left out here: it would cost a join table and
migration, an `EXISTS` subquery in the scope function, a transactional
owner/primary-assignment invariant, three endpoints, a management UI, and a wave of extra
RBAC-matrix rows to test — real hours for zero additional coverage against this brief, which
asks for role-based access control, not account teams. The scope function is a one-line
change (`owner_id == self` → `owner_id == self OR EXISTS assignment`) when that requirement
becomes real.

---

## Testing

```bash
cd backend
pytest              # 48 tests across 7 files
ruff check .
```

| File | Covers |
|---|---|
| `test_auth.py` | register forces `csm` role, duplicate email → 409, generic 401 on bad credentials, refresh rotation + `REFRESH_RACE` grace window, reuse past the grace window revokes the token family, error envelope keeps its request-id even on an unhandled exception |
| `test_rbac.py` | csm blocked from another csm's customer / can read own, manager reads any, admin vs csm list scoping, csm delete forbidden, csm creating for another owner forbidden, manager reassignment moves scope |
| `test_customers.py` | duplicate email 409 on create + update, pagination envelope, `q`/`status`/health-range filters, invalid `sort` → 422 |
| `test_interactions.py` | pending insight row exists on create, create on a non-owned customer → 403, `notes` under 20 chars → 422, nested-list scoping, type/date-range filters, delete rules, author-vs-role update rule |
| `test_ai.py` | Groq fails → Cerebras succeeds, both fail → still 201, unrecoverable malformed JSON → `failed` not 500, regenerate flips `failed` → `completed` |
| `test_cache.py` | encoder round-trips Decimal/UUID/datetime, version bump changes the key, scope is embedded in the key, a cache hit avoids a second query, a customer write invalidates the dashboard cache, csm-scoped vs admin-global isolation, Redis down still returns 200 (fail-open), at-risk ordering |
| `test_users.py` | csm cannot list users, manager can list but not create, admin creates, duplicate email 409, admin cannot deactivate self |

No frontend automated tests (see "Honest scope notes" above).

---

## Repository layout

```
backend/    FastAPI app (app/{api,services,repositories,models,schemas,core,llm}), Alembic, pytest, Dockerfile
frontend/   Next.js App Router + TypeScript + Redux Toolkit, Dockerfile
plans/      Phase-by-phase build plan and progress log (00-master-plan.md is the source of truth this README is drawn from)
docs/       Demo video recording script
docker-compose.yml   Postgres + Redis + backend + frontend, full local stack
```
