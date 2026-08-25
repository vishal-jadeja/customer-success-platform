# 00 — Master Plan: AI-Powered Customer Success Platform

> Tracked working notes (committed with the repo). The "Design Decisions & Trade-offs" section at the bottom is written to be lifted verbatim into the README.

## Product

AI-powered Customer Success Platform. Users manage customers and interactions, generate AI insights from meeting notes, and view operational metrics on a dashboard. Three roles: `admin`, `manager`, `csm`.

## Stack (locked — do not propose alternatives)

**Frontend:** Next.js App Router + TypeScript · Redux Toolkit (`createSlice` + `createAsyncThunk`, **no RTK Query**), normalised `entities`/`ids` + `idle|loading|succeeded|failed` status per slice · Axios shared instance with request (auth) + response (401) interceptors · Tailwind · react-hook-form + zod · Recharts.

**Backend:** Python + FastAPI · **synchronous** SQLAlchemy 2.0 + psycopg2-binary (sync runs in FastAPI's threadpool) · Alembic (never `create_all`) · Pydantic v2 + pydantic-settings · PostgreSQL · Redis · JWT via pyjwt · `bcrypt` (direct, no passlib).

**AI:** Groq primary, Cerebras failover. Both OpenAI-compatible. One `LLMProvider` protocol, two implementations. Free-tier models. Keys/models/order from env.

**Deploy:** backend on Render, frontend on Vercel, Postgres on Neon, Redis on Upstash.

## Decisions locked with the user

| # | Decision | Consequence |
|---|---|---|
| 1 | Access token in Redux memory; refresh token in httpOnly + Secure + **SameSite=Lax** cookie, made **first-party** via a Next.js reverse proxy | Browser only ever talks to the Vercel origin (`/api/v1` → proxied to Render). No cross-site cookie, so no ITP/Chrome breakage. CORS no longer load-bearing. Axios uses a relative `baseURL`, no `withCredentials`. Route guard + silent refresh on mount. |
| 2 | AI inline synchronous; interaction **and** a `pending` insight row committed together, then the row is updated to completed/failed | No polling, no worker. One spinner. `pending→completed/failed` is a genuine observed state; regenerate has a sane starting point. |
| 3 | Single-tenant, ownership-based scoping (`customers.owner_id`) | No `organizations` table. "Own" = `owner_id == self`. Ownership check in service layer. |
| 4 | Thin pytest suite (~4–6 backend tests, written in-phase), no frontend tests | Tests live at the end of the phase whose code they cover, not a separate phase. Shared `tests/conftest.py` (test DB, fakeredis, rate-limit off) is built in Phase 03. Trade-off documented. |

## Settings added by the senior review (post-Phase-01)

| Setting | Default | Why |
|---|---|---|
| `GROQ_API_KEY`, `GROQ_MODEL`, `CEREBRAS_API_KEY`, `CEREBRAS_MODEL` | `""` (optional) | A grader running `docker compose up` without LLM keys must still get a booting app. Providers with an empty key are skipped; zero providers ⇒ insight `failed`, `error_message="no LLM provider configured"`. |
| `LLM_TOTAL_BUDGET_SECONDS` | `35` | One overall deadline across providers **and** repair calls, so worst case stays under the 45 s client cap (2 × (15 + 15) = 60 s otherwise). |
| `RATE_LIMIT_ENABLED` | `True` (`False` under pytest) | Behind the Vercel→Render proxy every user shares one source IP; the limiter keys on the first `X-Forwarded-For` hop and is switched off in tests. |
| `REFRESH_REUSE_GRACE_SECONDS` | `10` | Two tabs hard-refreshing at once both present the same refresh cookie; without a grace window the second is "reuse" and logs the user out. |
| `COOKIE_SECURE` | `true` in prod, **`false` in the local `.env.example`** | Safari rejects `Secure` cookies over `http://localhost`. |

## Layering (enforced)

```
app/api/v1/routers/*.py   HTTP only — parse, call service, return schema
app/services/*.py         business rules, ownership checks, cache orchestration, transactions
app/repositories/*.py     ALL SQLAlchemy queries — and only here
app/models/*.py           ORM models
app/schemas/*.py          Pydantic v2, one per direction
app/core/*.py             config, security, logging, exceptions, redis, deps
app/llm/*.py              provider protocol + Groq/Cerebras + failover client
```

Review gate: `grep -rE "select\(|db\.query|session\.execute" app/api/` returns **zero** hits.

## ERD

### users
| column | type | notes |
|---|---|---|
| id | UUID PK | uuid4 default |
| email | VARCHAR(255) UNIQUE | indexed, lowercased |
| hashed_password | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(120) | NOT NULL |
| role | ENUM admin\|manager\|csm | default csm |
| is_active | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMPTZ | now() / onupdate |

### refresh_tokens
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK users ON DELETE CASCADE | indexed |
| token_hash | VARCHAR(64) UNIQUE | SHA-256 hex — **raw token never stored** |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ NULL | set on rotation/logout |
| created_at | TIMESTAMPTZ | |

Rotation: every `/auth/refresh` revokes the presented token, issues a new one. **Reuse detection:** presented token already revoked → revoke entire family for that user → 401. Highest-value security detail; feature it in README + video.

### customers
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(160) | NOT NULL |
| company | VARCHAR(160) | NOT NULL |
| email | VARCHAR(255) UNIQUE | 409 conflict path |
| phone | VARCHAR(32) NULL | |
| industry | VARCHAR(80) NULL | |
| status | ENUM onboarding\|active\|at_risk\|churned | default onboarding |
| health_score | SMALLINT | default 50, CHECK 0–100 |
| arr | NUMERIC(12,2) NULL | dashboard money metric |
| owner_id | UUID FK users ON DELETE RESTRICT | NOT NULL, indexed — accountable owner |
| created_at / updated_at | TIMESTAMPTZ | |

Indexes: `(owner_id, status)`, `(created_at DESC)`.

`owner_id ON DELETE RESTRICT`: deleting a user who still owns customers raises `IntegrityError` → mapped to `ConflictError` 409, never an unhandled 500.

### interactions
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK customers ON DELETE CASCADE | indexed |
| user_id | UUID FK users ON DELETE RESTRICT | logged by |
| type | ENUM meeting\|call\|email\|support_ticket\|qbr | NOT NULL |
| title | VARCHAR(200) | NOT NULL |
| notes | TEXT | NOT NULL, min 20 chars — AI input |
| occurred_at | TIMESTAMPTZ | NOT NULL |
| duration_minutes | SMALLINT NULL | |
| created_at / updated_at | TIMESTAMPTZ | |

Index: `(customer_id, occurred_at DESC)`.

### insights (1:1 interaction)
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| interaction_id | UUID FK interactions ON DELETE CASCADE | **UNIQUE** |
| status | ENUM pending\|completed\|failed | default pending |
| summary | TEXT NULL | |
| sentiment | ENUM positive\|neutral\|negative NULL | |
| action_items | JSONB default `[]` | |
| risks | JSONB default `[]` | |
| raw_response | TEXT NULL | raw model output, per spec |
| error_message | TEXT NULL | |
| provider | VARCHAR(32) NULL | groq/cerebras; `seed` for seeded rows (no LLM) |
| model | VARCHAR(80) NULL | |
| latency_ms | INTEGER NULL | |
| attempts | SMALLINT default 0 | |
| created_at / updated_at | TIMESTAMPTZ | |

## RBAC matrix

"Own" = `owner_id == self`.

| Action | admin | manager | csm |
|---|---|---|---|
| List / view customers | all | all | own only |
| Create customer | any owner | any owner | forced self-owned |
| Update customer | any | any | own only |
| Reassign owner_id | ✅ | ✅ | ❌ 403 |
| Delete customer | ✅ | ❌ | ❌ |
| List/view interactions | all | all | on own customers |
| Create interaction | any customer | any customer | own customers |
| Update interaction | any | any | own-authored |
| Delete interaction | ✅ | ✅ | ❌ |
| Regenerate insight | ✅ | ✅ | own customers |
| Dashboard | global | global | own book |
| List users | ✅ | ✅ read-only | ❌ |
| Create/modify users | ✅ | ❌ | ❌ |

Two-level enforcement: **route** `Depends(require_roles(...))` (verb gate) + **service** `_assert_can_access(obj, user)` (row gate). Both required.

Single scope function, reused by customers and (via parent join) interactions:

```python
def apply_customer_scope(stmt, user):
    if user.role in (Role.admin, Role.manager):
        return stmt
    return stmt.where(Customer.owner_id == user.id)
```

## API surface

Prefix `/api/v1`. Auth: `–` public · `A` access token · `C` refresh cookie.

| Method | Path | Auth | Roles | Purpose |
|---|---|---|---|---|
| POST | /auth/register | – | – | Signup. Role forced `csm`. |
| POST | /auth/login | – | – | Access token + user; set refresh cookie. `slowapi` rate-limited (10/min per client IP) |
| POST | /auth/refresh | C | – | Rotate refresh, new access |
| POST | /auth/logout | C | – | Revoke + clear cookie, 204 |
| GET | /auth/me | A | any | Profile |
| PATCH | /auth/me | A | any | Update name / password |
| GET | /users | A | admin, manager | Paginated users |
| POST | /users | A | admin | Create user any role |
| PATCH | /users/{id} | A | admin | Role / deactivate |
| DELETE | /users/{id} | A | admin | Soft delete (`is_active=false`); hard delete is never exposed, so `ON DELETE RESTRICT` only guards direct DB access |
| GET | /customers | A | scoped | filters/sort/pagination |
| POST | /customers | A | any | Create. CSM: `owner_id` omitted → self-owned; `owner_id` ≠ self → 403 (service check) |
| GET | /customers/{id} | A | scoped | Detail + interaction count |
| PATCH | /customers/{id} | A | admin/manager/owner-csm | Update |
| DELETE | /customers/{id} | A | admin | Hard delete, cascades |
| GET | /customers/{id}/interactions | A | scoped | Nested list |
| GET | /interactions | A | scoped | filters |
| POST | /interactions | A | scoped | Create + inline AI |
| GET | /interactions/{id} | A | scoped | Detail incl insight |
| PATCH | /interactions/{id} | A | admin/manager/author | Update |
| DELETE | /interactions/{id} | A | admin, manager | Delete |
| POST | /interactions/{id}/insight/regenerate | A | admin/manager/owner-csm | Retry insight |
| GET | /dashboard/summary | A | scoped | KPI cards — cached |
| GET | /dashboard/sentiment-trend | A | scoped | ?days=30 — cached |
| GET | /dashboard/at-risk | A | scoped | Top at-risk — cached |
| GET | /healthz | – | – | DB SELECT 1 + Redis PING |

List envelope: `{ items, total, page, page_size, total_pages }`.

## Error envelope

```json
{ "error": { "code": "PERMISSION_DENIED", "message": "...", "details": null, "request_id": "..." } }
```

| Exception | Status | code |
|---|---|---|
| NotFoundError | 404 | NOT_FOUND |
| PermissionDeniedError | 403 | PERMISSION_DENIED |
| ValidationError (app) | 422 | VALIDATION_ERROR |
| ConflictError | 409 | CONFLICT |
| IntegrityError (unique email; `ON DELETE RESTRICT`) | 409 | CONFLICT — caught in repo, mapped to `ConflictError`; never a raw 500 |
| AuthError | 401 | UNAUTHORIZED |
| AuthError (refresh reused inside the 10 s grace window) | 401 | REFRESH_RACE — client retries `/auth/refresh` once; family **not** revoked |
| ExternalServiceError | 502 | EXTERNAL_SERVICE_ERROR |
| RequestValidationError | 422 | VALIDATION_ERROR + field details |
| unhandled Exception | 500 | INTERNAL_ERROR, generic message, traceback logged only |

Request-ID middleware: read `X-Request-ID` or gen uuid4 → `contextvars` → logging filter injects into every line → echo on response header + in error body.

## Caching — version-key namespace

Namespaces: `customers`, `interactions`, `dashboard`.

```
version key: csp:ver:{ns}                                     integer counter
cache key:   csp:{ns}:{op}:v{version}:{scope}:{sha1(params)}
```

Read: GET version (missing→SET 1) → build key → GET → hit deserialize / miss query+SETEX.
Invalidate: `INCR csp:ver:{ns}` — O(1) atomic, old keys unreachable, expire on TTL.

Why not KEYS/SCAN: KEYS is O(N) and blocks Redis's single thread; SCAN is non-atomic multi-round-trip with a stale-read window. INCR is O(1), atomic, correct. Cost: orphan keys linger to TTL — bounded, acceptable.

**Namespace-global invalidation (named limitation).** A version bump is per-namespace, not per-scope: one CSM's write invalidates every user's cached list in that namespace. This is correct (never serves stale data) and right for this scale. Call it out yourself in the README + video: *"coarse-grained but correct; per-scope version counters if write volume grew."* Naming the limitation reads as senior.

Write fan-out: customer write → bump customers + dashboard · interaction write → interactions + dashboard · insight completed → interactions + dashboard.

Scope in key is mandatory: csm → `csm-{user_id}`; admin/manager → `role-{role}`. Missing scope leaks one CSM's book to another.

TTLs: list 60s · detail 120s · dashboard 120s · trend 300s.

Fail-open: `redis.RedisError`/`ConnectionError` → warn (with request id) → fall through to DB. Redis down = slower, never wrong, never 5xx.

## AI pipeline

`LLMProvider` protocol → `GroqProvider`, `CerebrasProvider` → `FailoverLLMClient([...])` ordered by `LLM_PROVIDER_ORDER`. One httpx call shape (OpenAI-compatible); only base URL/key/model differ. `response_format=json_object`, `temperature=0.2`, notes truncated to 8000 chars.

Parse chain: `json.loads` → fenced-block extract + retry → one repair call → give up. Validate with `InsightPayload` Pydantic model; sentiment lowercased, unknown→neutral.

Failure matrix:
| Failure | Action |
|---|---|
| httpx.TimeoutException | WARN + request id + provider, next provider |
| 429 / 5xx | WARN, next provider |
| 401 / 403 | ERROR bad creds, next provider, never retry same |
| JSONDecodeError | fenced extract → repair → fail |
| pydantic ValidationError | repair → fail |
| all exhausted | status=failed, error_message, raw_response=last body, attempts++ |
| AI_ENABLED=false | skip, status=failed, error_message='AI disabled' |

Hard rule: the interaction **and** its `status='pending'` insight row are committed together in one transaction **before** the LLM call. The LLM call then updates that row to `completed`/`failed` in a second commit. AI failure updates the insight row only. `POST /interactions` → **201 with insight showing `status='failed'`** on failure (never 5xx, never rollback). `pending` is a genuine observed state, so regenerate starts from a real row. Frontend shows "Generation failed — Retry" wired to regenerate.

## Phases & dependencies

`01 → 02 → 03 → {04 → 05 → 06} → 07 → 08 → {09 → 10} → 11 → 12 → 13`

Tests are no longer a phase — each critical test is the final checklist item of the phase whose code it covers (a test phase at hour 13 does not happen). Old Phase 13 is dissolved; old Phase 14 (README) is renumbered to 13.

| # | Phase | Est |
|---|---|---|
| 01 | Scaffold, config, .env.example, Compose (PG+Redis) | 45m |
| 02 | Models, Alembic migration, seed | 1h |
| 03 | Auth + rotating refresh (+ reuse grace window) + RBAC + error envelope + request-id + rate limit **+ `tests/conftest.py` + reuse-detection test + full end-to-end deploy (minimal FE skeleton)** | 2h50 |
| 04 | Customers CRUD + filters + pagination **+ RBAC-denial test** | 1h20 |
| 05 | Interactions CRUD + filters + nested (+ pending insight row) | 45m |
| 06 | AI pipeline Groq+Cerebras failover **+ failover/malformed-JSON test** | 1h30 |
| 07 | Dashboard endpoints + Redis cache + invalidation **+ cache-invalidation test** | 1h15 |
| 08 | Frontend foundation (proxy rewrite, relative axios) **+ profile page** | 1h45 |
| 09 | Frontend customers + interactions **(list w/ filters, detail, create, edit — all PDF capabilities)** | 1h45 |
| 10 | Frontend AI panel + dashboard charts (+ optional Users admin page, first to cut) | 1h30 |
| 11 | Dockerfiles + full Compose | 45m |
| 12 | Re-deploy + verify (deploy already stood up in 03) | 45m |
| 13 | README + demo script + verification | 1h |

**Summed focused-build estimate ≈ ~16h30–17h** (senior review added the PDF capabilities that had no frontend plan — profile page, interaction detail/edit/filters — plus test infrastructure; the phase files' estimates now match this table).

**Realistic wall-clock: 24–30 hours.** Sync SQLAlchemy setup, Alembic enum quirks, a first Render deploy, and video re-records each eat clock the phase estimates don't show. Every graded deliverable — Docker Compose, README, both live URLs, the demo video — sits at the end of the sequence, exactly where an over-scoped plan runs out of time. **An unfinished ambitious build scores worse than a complete modest one.**

## Cut order — executed when the schedule slips (not only on an external blocker)

When you are behind, drop these in order, least-costly first:

1. Dashboard sentiment-trend chart (KPI cards + at-risk list stay — "dashboard reporting" is still delivered)
2. Users admin page (`/users` list + role select) — remove the nav link with it; the backend endpoints stay
3. Customer edit-page polish (keep a working edit form; drop the nice-to-haves)

**Not cuttable, ever** — each is a capability named in the PDF or a submission artefact: profile page · interaction detail / update / list filters · both Dockerfiles + full-stack Compose. The previous cut order listed "interaction edit form" and "infra-only Compose"; both would have dropped graded items.

Frontend vitest stays out — that was a scope choice in Decision 4, not a time-pressure cut.

**Never sacrificed:** refresh rotation + reuse detection · two-level RBAC · owner-scoped queries · customer CRUD · interaction CRUD **(incl. detail + edit + filters in the UI)** · profile page · AI failover + failure handling · dashboard summary · Redis cache + invalidation · **both Dockerfiles + full-stack Compose** · both deployed URLs · README · demo video.

## Risks

- **Refresh cookie — mitigated by design.** The Next.js reverse proxy makes the cookie first-party (`SameSite=Lax`, no `Domain`), so Safari ITP / Chrome third-party-cookie behaviour is a non-issue. No scheduled smoke test needed for the cookie itself; the Phase 03 end-to-end deploy verifies the whole login round-trip anyway.
- Render free-tier cold start (~50s) — hit URL before recording; note in README.
- Alembic autogenerate skips `CREATE TYPE` for enums on first migration — see Phase 02 pitfalls.
- Groq rate limits during seed — seed writes insights straight to DB with `status=completed`, `provider='seed'`, no LLM call.
- First deploy at hour 3 (not hour 12) — a deploy problem is an inconvenience early, fatal late. Phase 03 stands the whole stack up on the deployed URLs. **Render uses the native Python runtime** (no Dockerfile exists yet at Phase 03; the Dockerfiles are for Compose/grading).
- **`next.config.js` rewrites are resolved at build time**, not request time. `BACKEND_URL` must be present when `next build` runs — set before the Vercel build, and passed as a Docker `ARG` in Phase 11. (The old plan called it "runtime, not baked"; that was wrong.)
- **Rate limiting behind the proxy.** All browser traffic reaches Render from the Vercel proxy, so a limiter keyed on the socket IP throttles *everyone together*. Key on `X-Forwarded-For`, and disable under pytest.
- **Cold start vs. silent refresh.** The mount-time `/auth/refresh` must tolerate a ~50 s Render wake-up (60 s timeout on that one call + "waking up the server…" banner), or the first visitor is bounced to `/login`.
- **Multi-tab refresh race.** Two tabs presenting the same refresh cookie within milliseconds would trip reuse detection; a 10 s grace window keeps strict revocation for real theft (minutes/hours later) without logging out honest users.

---

# Design Decisions & Trade-offs (lift into README)

**Auth — access in memory, refresh in a first-party httpOnly cookie, with rotation + reuse detection.** Access tokens are short-lived and held only in Redux memory, so an XSS payload cannot read a long-lived credential from storage. The refresh token lives in an httpOnly+Secure+**SameSite=Lax** cookie JS cannot touch. The frontend never calls the backend cross-origin: a **Next.js reverse proxy** rewrites `/api/v1/*` to the backend, so from the browser's view the cookie is first-party to the Vercel origin. This sidesteps Safari ITP and Chrome's third-party-cookie behaviour entirely — a `SameSite=None` cross-site cookie between Vercel and Render (both on the Public Suffix List, so no shared parent domain) would have worked on localhost and then silently failed in production. As a bonus the Render URL never reaches the client. Every refresh rotates the token; presenting an already-revoked token triggers family-wide revocation — the standard defence against refresh-token theft — except inside a 10 s grace window, which absorbs the benign case of two tabs refreshing at once. Because the cookie is `SameSite=Lax`, a cross-site page cannot make the browser send it on a POST, so `/auth/refresh` is CSRF-safe without a separate CSRF token. The access token carries the role only as a hint: every request loads the user from the DB, so a role change or deactivation takes effect immediately rather than at token expiry.

**RBAC — two levels.** A role dependency on the route gates the verb; a service-layer ownership check gates the row. Route-only would let a CSM edit another CSM's customer; service-only would lose the self-documenting route contract. Scope is a single function (`apply_customer_scope`): admin/manager see all, a CSM sees `owner_id == self`.

**Sync SQLAlchemy over async.** Deliberate reliability choice under time pressure. FastAPI runs sync DB calls in a threadpool, so throughput is fine for this scale and the code is simpler to get right.

**Caching — version-key namespace, not KEYS/SCAN.** Invalidation is a single atomic `INCR` on a namespace counter embedded in every cache key. KEYS blocks Redis's single thread; SCAN is non-atomic with a stale-read window. Trade-off: orphaned keys linger until TTL — bounded and acceptable. Invalidation is **namespace-global**: one user's write bumps the whole namespace's version, so every user's cached list in that namespace is invalidated at once. That is coarse-grained but always correct (never stale) and right for this scale; per-scope version counters would be the move if write volume grew. Cache is fail-open: Redis down degrades speed, never correctness.

**AI — inline, but resilient.** Insight generation runs inside the create request (Groq is fast). The interaction and a `pending` insight row are committed together *before* the LLM call, so AI failure never blocks or rolls back the write; the LLM result then updates that row to `completed`/`failed` in a second commit, and the endpoint returns 201 with the insight (`status='failed'` on total failure) and the UI offers a retry. Because the row is committed up front, `pending` is a genuine state and regenerate always has a real row to act on. Groq is primary with automatic Cerebras failover; responses are parsed defensively (fenced-block extraction → repair call) and the raw model output, status, provider, and error are all persisted.

**Testing — thin critical-path pytest, no frontend tests.** Under a one-day budget, backend tests cover the highest-risk logic (refresh rotation/reuse, RBAC denial, AI failover + malformed-JSON repair, cache invalidation) and are written in-context at the end of the phase that produces the code, not batched into a separate late phase. Frontend tests were consciously descoped; validation is mirrored (zod ↔ Pydantic) so client and server enforce the same rules regardless.

## What I'd build next

**Account Team access (out of scope here).** Real CS teams need more than one accountable owner: a solutions architect, an exec sponsor, and a backup CSM all legitimately need access to an account they don't "own." A single `owner_id` cannot express that — it collapses accountability and access into one column. The industry answer is Salesforce's `OwnerId` (one accountable owner) **+** `AccountTeamMember` (many members, each with a descriptive role and access level), the pattern HubSpot and Gainsight also ship. I deliberately left it out: it would have cost a join table and migration, an `EXISTS` subquery in the scope function, a transactional owner/primary-assignment invariant, three endpoints, a management UI, and a wave of extra RBAC-matrix rows to test — real hours for zero additional rubric coverage, since the brief asks for role-based access control, not account teams. The scope function is a one-line change (`owner_id == self` → `owner_id == self OR EXISTS assignment`) when that requirement is real.
