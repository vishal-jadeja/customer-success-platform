# Phase 03 — Authentication, RBAC, Error Envelope, Request-ID Logging

## Objective
Once done: a user can register (role forced `csm`), log in (receiving an access token in the body and a refresh token in an httpOnly+Secure+**SameSite=Lax** cookie with **no `Domain`**), call `/auth/me`, rotate via `/auth/refresh`, and log out. Refresh tokens rotate on every use and reuse of a revoked token revokes the whole family. `POST /auth/login` is rate-limited with `slowapi`. All errors return the single JSON envelope from centralised handlers (including DB `IntegrityError` → 409), and every log line and error body carries a request ID. `require_roles` and `get_current_user` dependencies are ready for later modules. **The phase ends by standing the whole stack up on the deployed URLs** (minimal frontend skeleton) so the first deploy happens at hour ~3, not hour ~12.

## Depends on
Phase 02.

## Estimated time
2h50 (includes `tests/conftest.py` and the first end-to-end deploy).

## Files created or modified
```
backend/app/core/
  security.py        # password hash/verify, JWT encode/decode, token hashing
  exceptions.py      # AppError + subclasses
  errors.py          # handlers -> JSON envelope (incl IntegrityError->409), registered on app
  ratelimit.py       # slowapi Limiter (key=remote address), handler
  logging.py         # request-id contextvar, filter, formatter, get_logger
  middleware.py      # RequestIDMiddleware
  redis.py           # redis client + safe_cache wrapper (fail-open)
  deps.py            # get_db re-export, get_current_user, require_roles
backend/app/repositories/user.py
backend/app/repositories/refresh_token.py
backend/app/services/auth_service.py
backend/app/schemas/auth.py     # RegisterIn, LoginIn, TokenOut, UserOut, MeUpdateIn
backend/app/api/v1/routers/auth.py
backend/app/main.py             # register handlers, middleware, include router
backend/tests/conftest.py       # shared test infrastructure (see "Test infrastructure")
backend/tests/test_auth.py
```

## Tasks
1. `security.py`: `hash_password`/`verify_password` via the `bcrypt` package directly (`bcrypt.hashpw(pw.encode(), bcrypt.gensalt())` / `bcrypt.checkpw`) — **not passlib** (unmaintained; breaks with `bcrypt>=4.1` and Python 3.13). `create_access_token(sub, role)` → pyjwt HS256 with `exp` from `ACCESS_TOKEN_TTL_MIN`. `decode_access_token`. `new_refresh_token()` → returns `(raw, sha256_hex)`; only the hash is stored.
2. `exceptions.py`: `AppError(message, code, status, details=None)` base; subclasses `NotFoundError`(404), `PermissionDeniedError`(403), `ValidationError`(422), `ConflictError`(409), `AuthError`(401), `ExternalServiceError`(502).
3. `errors.py`: handler for `AppError` → envelope; handler for FastAPI `RequestValidationError` → 422 with `details`=errors; **handler for SQLAlchemy `IntegrityError` → `ConflictError` 409** (covers unique-email violations and `ON DELETE RESTRICT` — e.g. deleting a user who still owns customers — so neither surfaces as an unhandled 500); handler for bare `Exception` → 500 generic + log traceback. All read the request-id from the contextvar. `register_error_handlers(app)`.
4. `logging.py`: `contextvars.ContextVar` `request_id_var`; logging `Filter` injects it; formatter includes it; `get_logger(name)`.
5. `middleware.py`: read `X-Request-ID` header or `uuid4()`, set contextvar, set response header, and (belt+braces) attach to `request.state`.
6. `redis.py`: build client from `REDIS_URL`; `safe_get`/`safe_setex`/`safe_incr` wrappers catching `redis.RedisError` → log warn → return None (fail-open).
7. Repositories: `user.py` (get_by_email, get_by_id, create, update); `refresh_token.py` (create, get_by_hash, revoke, revoke_all_for_user).
8. `auth_service.py`:
   - `register`: lowercase email, conflict check → `ConflictError`, force role csm, hash password.
   - `login`: verify creds → `AuthError`; mint access + refresh; store refresh hash with expiry; return `(access, raw_refresh, user)`.
   - `refresh(raw)`: hash, look up. If not found → `AuthError`. **If found but `revoked_at` set:** if `now - revoked_at > REFRESH_REUSE_GRACE_SECONDS` (10 s) → `revoke_all_for_user` + `AuthError` (**reuse detection** — real theft is minutes/hours later); if within the grace window → `AuthError` 401 with `code=REFRESH_RACE` and **no** family revocation (benign concurrent refresh from a second tab). Recovery is client-side: the browser's cookie jar already holds the new cookie set by the first tab's response, so the second tab's `AuthGuard` retries `/auth/refresh` once (Phase 08) and succeeds. Else revoke this one, mint new pair, return. Also check `expires_at` → `AuthError`.
   - `logout(raw)`: revoke by hash; idempotent.
9. `deps.py`: `get_current_user` — parse `Authorization: Bearer`, decode, load active user or `AuthError`. `require_roles(*roles)` — dependency factory returning a checker that raises `PermissionDeniedError` if `user.role` not in roles.
10. `auth.py` router: endpoints per API table. Cookie helpers set `httponly=True, secure=settings.COOKIE_SECURE, samesite="lax", path="/api/v1/auth", max_age=REFRESH_TTL` — **no `Domain` attribute** (defaults to the host the browser saw, i.e. the Vercel origin, keeping it first-party). Logout clears it with the exact same path/attributes.
11. `slowapi` on `POST /auth/login`: `Limiter(key_func=client_ip, enabled=settings.RATE_LIMIT_ENABLED)` where `client_ip` returns the **first hop of `X-Forwarded-For`** (fallback `get_remote_address`). Behind the Vercel→Render proxy every browser arrives from the same socket IP, so keying on the socket would throttle all users together. `@limiter.limit("10/minute")`. `RATE_LIMIT_ENABLED=False` under pytest (conftest) — otherwise the suite's dozens of logins trip it.
12. `main.py`: `register_error_handlers`, add `RequestIDMiddleware`, wire the `slowapi` limiter + handler, include auth router under `/api/v1`.

## Error handling requirements
- Wrong password / unknown email → `AuthError` 401, message generic ("Invalid credentials") — never reveal which field.
- Expired/invalid access token → `AuthError` 401 (catch `jwt.ExpiredSignatureError`, `jwt.PyJWTError`).
- Reused (already-revoked) refresh token → revoke entire family, 401.
- Inactive user (`is_active=false`) presenting a valid token → `AuthError` 401.
- Duplicate email on register → `ConflictError` 409 (via the `IntegrityError` handler; no pre-check).
- `ON DELETE RESTRICT` violation (e.g. deleting a still-owning user) → `IntegrityError` → 409, never 500.
- More than 10 logins/min from one client IP (`X-Forwarded-For` first hop) → `slowapi` 429; disabled in tests.
- Any unhandled exception → 500 envelope, generic message, full traceback logged with request id only.

## Acceptance criteria
- Register→login→me→refresh→logout full cycle via curl succeeds.
- Login response sets a `Set-Cookie` with `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` and **no `Domain`**.
- Refresh returns a NEW access token and rotates the cookie; the old refresh token no longer works.
- Presenting an already-used refresh token returns 401 AND invalidates all that user's tokens (a subsequent refresh with any of their tokens → 401).
- Every response carries `X-Request-ID`; every error body includes the same id.

## Verification
```
# register + login
curl -si -X POST :8000/api/v1/auth/register -d '{"email":"a@x.com","password":"pw123456","full_name":"A"}' -H 'content-type: application/json'
curl -si -c cookies.txt -X POST :8000/api/v1/auth/login -d '{"email":"a@x.com","password":"pw123456"}' -H 'content-type: application/json'
# use access token
curl -s :8000/api/v1/auth/me -H "authorization: Bearer <ACCESS>"
# rotate
curl -si -b cookies.txt -c cookies.txt -X POST :8000/api/v1/auth/refresh
# reuse detection: replay the OLD cookie -> 401 + family revoked
```

## Known pitfalls
- **bcrypt 72-byte limit:** bcrypt ignores/raises past 72 bytes. Cap password length in the zod + Pydantic schema (8–72 chars).
- **Don't use passlib.** 1.7.4 is the last release (2020); it probes `bcrypt.__about__` (removed in 4.1) and imports the stdlib `crypt` module (removed in Python 3.13). Six lines of `bcrypt` directly is safer.
- **SameSite=Lax + first-party via the proxy.** Because the browser only ever hits the Vercel origin (`/api/v1/*` is proxied to Render server-side), the refresh cookie is first-party — `SameSite=Lax` is enough and there is no cross-site cookie to break under Safari ITP / Chrome. Never set a `Domain`. `Secure=true` is mandatory in prod (https). Locally use `COOKIE_SECURE=false`: Chrome/Firefox accept `Secure` cookies on `http://localhost`, Safari does not.
- **Cookie `path`:** scope the refresh cookie to `/api/v1/auth` so it isn't sent on every API call. Match the path exactly when clearing it, or logout won't delete it.
- **pyjwt `exp`:** pass a `datetime`/timestamp; pyjwt validates `exp` automatically on decode — catch `ExpiredSignatureError` explicitly.
- **Threadpool + sessions:** never share one `Session` across requests. Always use the `get_db` dependency per request; sync SQLAlchemy sessions are not thread-safe.
- **Storing raw refresh tokens is a fail:** store only the SHA-256 hash. The raw value lives only in the cookie.

## Test infrastructure (build once here; Phases 04/06/07 reuse it)
`backend/tests/conftest.py`:
- `TEST_DATABASE_URL` (default `postgresql+psycopg2://csp:csp@localhost:5432/csp_test`; create the DB once: `createdb -U csp csp_test` or `docker compose exec postgres createdb -U csp csp_test`). SQLite is not an option — the schema uses Postgres enums and JSONB.
- Session-scoped fixture runs `alembic upgrade head` against it (Alembic's `command.upgrade(Config(...), "head")` with `sqlalchemy.url` overridden).
- Per-test `db` fixture: open a connection, `begin()`, bind a `Session` to it, `yield`, `rollback()`. Override `app.dependency_overrides[get_db]` to yield that session so every request in the test sees (and cannot leak) the same transaction.
- `redis` fixture: `fakeredis.FakeRedis` patched into `app.core.redis` (no external Redis in tests).
- Settings override: `RATE_LIMIT_ENABLED=False`, `AI_ENABLED` per-test, `COOKIE_SECURE=False`, **dummy LLM keys** (`GROQ_API_KEY=test`, `CEREBRAS_API_KEY=test`) so both providers are constructed and Phase 06's monkeypatch of `.complete` actually intercepts them.
- `frozen_time`/helper to **backdate `revoked_at`** on a refresh-token row (direct DB update) — needed to test reuse detection past the grace window.
- Role fixtures `admin`/`manager`/`csm`/`csm2` (created via the repo, not the API) + `token_for(user)` helper and a `client` (`TestClient`).
- Dev deps: `pytest`, `fakeredis`, `httpx` (TestClient transport).

## Test (final task of this phase — written in context, not a separate phase)
- `backend/tests/test_auth.py`: **refresh rotation + reuse detection.** Login → refresh rotates (old token now 401 `REFRESH_RACE`, family intact — that is the grace window working); then **backdate that token's `revoked_at` by > `REFRESH_REUSE_GRACE_SECONDS`** and replay it → 401 **and** the whole family is revoked (a subsequent refresh with the *current* cookie → 401). Without the backdate the replay lands inside the grace window and the family is deliberately kept. Also: register forces role `csm`; bad password → 401 generic. Monkeypatch nothing external; use `TestClient` with a fresh client to simulate the replayed/stolen token. This is the highest-value security test — write it here while the code is fresh.

## End-to-end deploy (final gate of this phase)
Do the first real deploy now, not at Phase 12 — a deploy problem at hour 3 is an inconvenience; at hour 12 it is fatal.
1. **Skeleton backend live on Render using the native Python runtime** (no Dockerfile exists yet; the Dockerfiles in Phase 11 are for Compose/grading): root dir `backend`, build `pip install .`, start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. **Neon Postgres** (pooler URL, `sslmode=require`) and **Upstash Redis** (`rediss://`) connected; `/healthz` green on the Render URL.
2. **Minimal Next.js frontend on Vercel:** `create-next-app`, a `next.config.js` rewrite `/api/v1/:path*` → `${process.env.BACKEND_URL}/api/v1/:path*`, `BACKEND_URL` set to the Render URL (server-side env), and a single page that logs in and calls `/auth/me`. No store/guard/UI yet — that is Phase 08.
3. **One complete login round-trip verified against the deployed URLs:** login sets the first-party `SameSite=Lax` cookie on the Vercel origin, `/auth/refresh` through the proxy succeeds, `/auth/me` returns the user. Confirm in DevTools that the cookie's domain is the Vercel host and no request goes to the Render domain from the browser.

Phase 12 then becomes a re-deploy-and-verify pass, not a first attempt.
