# Phase 07 — Dashboard Metrics + Redis Caching Layer

## Objective
Once done: three dashboard endpoints return scoped business metrics (KPI summary, sentiment trend, at-risk customers), each served through a version-key Redis cache with per-scope keys and TTLs. Every customer/interaction/insight write bumps the relevant namespace version so no stale data is ever served, and Redis being unavailable degrades to a direct DB read (fail-open) rather than an error.

## Depends on
Phase 06 (needs insights for sentiment metrics). Cache stubs from Phases 04–06 are replaced with real calls here.

## Estimated time
1h15.

## Files created or modified
```
backend/app/core/cache.py              # versioned key build, get_json/set_json, invalidate, json encoder
backend/app/repositories/dashboard.py  # summary/trend/at-risk queries (scoped)
backend/app/services/dashboard_service.py
backend/app/api/v1/routers/dashboard.py
# replace invalidate_* stubs in customer_service, interaction_service, insight_service
backend/app/main.py                    # include dashboard router
```

## Tasks
1. `core/cache.py`:
   - `_scope(user)` → `role-{role}` for admin/manager, `csm-{id}` for csm.
   - `_version(ns)` → `safe_get(csp:ver:{ns})` or `safe_setex/SET 1`.
   - `build_key(ns, op, user, params)` → `csp:{ns}:{op}:v{ver}:{scope}:{sha1(json(params))}`.
   - `get_json` / `set_json(ttl)` using a JSON encoder that handles `Decimal`→float/str, `UUID`→str, `datetime`→isoformat.
   - `invalidate(ns)` → `safe_incr(csp:ver:{ns})`. **Namespace-global by design:** a single `INCR` invalidates every user's cached entries in that namespace, not just the writer's scope. Correct (never stale) and right for this scale; note it as a README line + video talking point ("coarse-grained but correct; per-scope counters if write volume grew").
   - All wrapped fail-open (Phase 03 `safe_*`).
2. `repositories/dashboard.py` (all scoped via `apply_customer_scope`):
   - `summary`: total customers, by status counts, total ARR, avg health, interactions last 30d, sentiment breakdown.
   - `sentiment_trend(days)`: interactions grouped by day × sentiment.
   - `at_risk(limit)`: customers ordered by health asc / status=at_risk, top N.
3. `dashboard_service.py`: each method builds a cache key, `get_json` → hit returns; miss → repo query → `set_json` with TTL → return. TTLs: summary 120s, trend 300s, at-risk 120s.
4. Replace stubs: `customer_service` writes → `invalidate("customers"); invalidate("dashboard")`; `interaction_service` writes → `invalidate("interactions"); invalidate("dashboard")`; `insight_service` on completed/regenerated → `invalidate("interactions"); invalidate("dashboard")`. Also add list/detail caching to customers/interactions read paths (namespace `customers`/`interactions`) — optional if time-boxed; dashboard caching is the required demo.
5. `dashboard.py` router: three GET endpoints, `require` access token, scoped by `current_user`.
6. Update `/healthz` to actually PING Redis and `SELECT 1` (fail-soft: report component status, still 200 if degraded? — return 503 if DB down, 200 with `redis:"down"` if only Redis down).

## Error handling requirements
- Any `redis.RedisError`/`ConnectionError` in a cache call → warn with request id → fall through to DB. Never surface a 5xx from caching.
- Non-JSON-serializable value (Decimal/UUID/datetime) → handled by the custom encoder, never a `TypeError` at runtime.
- Empty result sets → return zeros/empty arrays, not nulls, so the frontend renders cleanly.

## Acceptance criteria
- First `GET /dashboard/summary` is a MISS (DB query); an immediate repeat is a HIT (log shows cache hit, no SQL).
- Creating/updating/deleting a customer makes the next `summary` a MISS again (version bumped) with fresh numbers — no stale data.
- A CSM's dashboard numbers reflect only their book; admin sees global — different results, different cache keys (scope in key).
- Stopping Redis mid-session: dashboard still returns correct data (from DB), logs a warning, returns 200.

## Verification
```
# hit/miss (watch logs)
curl -s :8000/api/v1/dashboard/summary -H "authorization: Bearer $ADMIN" >/dev/null   # MISS
curl -s :8000/api/v1/dashboard/summary -H "authorization: Bearer $ADMIN" >/dev/null   # HIT
# invalidation
curl -s -X POST :8000/api/v1/customers -H "authorization: Bearer $ADMIN" -d '{...}' -H 'content-type: application/json'
curl -s :8000/api/v1/dashboard/summary -H "authorization: Bearer $ADMIN" | jq .total_customers   # incremented, MISS
# scope isolation
curl -s :8000/api/v1/dashboard/summary -H "authorization: Bearer $CSM" | jq .total_customers      # smaller
# fail-open
docker compose stop redis && curl -si :8000/api/v1/dashboard/summary -H "authorization: Bearer $ADMIN"  # still 200
```

## Known pitfalls
- **Decimal isn't JSON-serializable:** `arr NUMERIC` → `Decimal`. The cache encoder MUST convert it (str to keep precision, or float for charts). A raw `json.dumps(decimal)` raises `TypeError` and, if uncaught, 500s — but fail-open would mask it as "always miss". Test the encoder directly.
- **Scope in the key is not optional:** without it, the admin's cached global figures get served to a CSM. This is the leak that fails the assessment — verify the scope-isolation acceptance case.
- **Version key init race:** if `csp:ver:{ns}` is missing, initialise to 1 atomically; a naive get→set can double-init but harmlessly. `INCR` on a missing key yields 1, which is fine — you can skip explicit init and just `INCR` on write, `GET or default 0` on read.
- **Timezone in trend grouping:** group by date in a consistent tz (UTC) or day buckets will smear across midnight.
- **Don't cache per-request objects** (ORM instances) — cache plain dicts built from schemas.

## Test (final task of this phase — written in context)
- `backend/tests/test_cache.py`: **cache invalidation after write.** `get_json` miss then hit on a repeated read (no second SQL). A customer write calls `invalidate("customers")` and the version key increments, so the next read is a MISS with fresh data. Assert the version counter incremented (or that the next read misses). Use the `fakeredis` fixture from `conftest.py`; no external network.
