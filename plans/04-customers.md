# Phase 04 — Customer Module (CRUD, filters, pagination)

## Objective
Once done: customers can be listed (with filtering, sorting, pagination in the standard envelope), viewed, created, updated, and deleted, all subject to the two-level RBAC. Scope is enforced by the single `apply_customer_scope` function so a CSM sees only customers they own (`owner_id == self`). Duplicate-email conflicts surface as 409 by catching `IntegrityError` (no pre-check race).

## Depends on
Phase 03.

## Estimated time
1h20.

## Files created or modified
```
backend/app/schemas/customer.py       # CustomerCreate, CustomerUpdate, CustomerOut, CustomerListItem
backend/app/schemas/common.py         # Page[T] envelope, PageParams
backend/app/repositories/customer.py  # apply_customer_scope, list_customers, get, create, update, delete
backend/app/services/customer_service.py
backend/app/api/v1/routers/customers.py
backend/app/main.py                   # include router
```

## Tasks
1. `schemas/common.py`: generic `Page` model (`items`, `total`, `page`, `page_size`, `total_pages`); `PageParams` dependency (`page>=1`, `1<=page_size<=100`).
2. `schemas/customer.py`: create/update/out schemas. `CustomerCreate` has no `owner_id` for CSM path (forced self); managers/admins may pass `owner_id`. `CustomerOut` includes `interaction_count` on detail.
3. `repositories/customer.py`:
   - `apply_customer_scope(stmt, user)` exactly as in master plan (admin/manager → all; csm → `owner_id == self`).
   - `list_customers(db, user, filters, sort, page)` — apply scope, then filters (`q` ILIKE name/company, `status`, `owner_id`, `industry`, `min_health`/`max_health`), sort whitelist (`created_at|name|health_score|arr` + order), `.limit/.offset`, plus a `count()` for total.
   - `get(db, id)`, `create`, `update`, `delete`. `create`/`update` **catch `IntegrityError` (unique email) → raise `ConflictError`** — never pre-check existence (that is a TOCTOU race).
4. `services/customer_service.py`:
   - `_assert_can_access(db, customer, user)` — admin/manager pass; csm must own (`owner_id == user.id`) else `PermissionDeniedError`.
   - `list/get/create/update/delete` orchestrate repo + access checks + owner rules. CSM create: `owner_id` omitted → `self`; `owner_id` present and ≠ self → `PermissionDeniedError` (explicit 403 beats silently overriding what the client sent). CSM update: any `owner_id` ≠ self → 403. Only admin/manager may set/change `owner_id`.
   - Delete: admin only (route-gated), hard delete cascades.
   - On create/update/delete call cache-invalidation hook (added in Phase 07; leave a `invalidate_customers()` call site now, no-op stub until then).
5. `api/v1/routers/customers.py`: wire endpoints with `require_roles` where the matrix demands, `PageParams` + filter query params, and pass `current_user` into the service.

## Error handling requirements
- Customer not found → `NotFoundError` 404 (check existence first, then access; a 404 vs 403 distinction is acceptable here since scope is by ownership not secrecy).
- CSM accessing non-owned customer → `PermissionDeniedError` 403.
- CSM supplying `owner_id` ≠ self on create or update → 403 (**service-level** check — it is a body field, so it cannot be route-gated).
- Duplicate email on create/update → `ConflictError` 409, produced by catching `IntegrityError`, **not** by a pre-existence check.
- Invalid sort field → `ValidationError` 422 (whitelist, never interpolate raw into SQL).

## Acceptance criteria
- Admin lists all customers; a CSM lists only owned; counts differ accordingly.
- CSM `GET /customers/{other}` → 403; `GET /customers/{own}` → 200.
- Creating as CSM with `owner_id` omitted → self-owned; with another user's id → 403.
- Manager changes `owner_id`; the customer moves out of the old owner's scope into the new owner's.
- Creating two customers with the same email → the second returns 409 (from `IntegrityError`), not a 500.
- List envelope has correct `total`/`total_pages` across pages.

## Verification
```
# as csm token: list is scoped
curl -s ":8000/api/v1/customers?page=1&page_size=5" -H "authorization: Bearer $CSM"
# forbidden
curl -si ":8000/api/v1/customers/$OTHER_ID" -H "authorization: Bearer $CSM"   # 403
# duplicate email -> 409, not 500
curl -si -X POST ":8000/api/v1/customers" -H "authorization: Bearer $MGR" -d '{"name":"A","company":"A","email":"dup@x.com"}' -H 'content-type: application/json'
curl -si -X POST ":8000/api/v1/customers" -H "authorization: Bearer $MGR" -d '{"name":"B","company":"B","email":"dup@x.com"}' -H 'content-type: application/json'  # 409
```

## Known pitfalls
- **Scope in one place only:** every list/get MUST route through `apply_customer_scope`. A hand-written query that forgets it is a data-leak bug — grep for direct `select(Customer)` outside the repo.
- **Sort injection:** never `f"order by {field}"`. Map an allowed string to a column object; unknown → 422.
- **Count query:** use a separate `select(func.count())` over the scoped+filtered statement, not `len(rows)` (which only counts the page).
- **Email conflict is a caught `IntegrityError`, not a pre-check:** `SELECT ... WHERE email=?` then insert is a race; two concurrent requests both pass the check. Insert and catch the unique violation.
- **Pagination off-by-one:** `offset=(page-1)*page_size`. Validate `page>=1`.
- Leave the cache-invalidation calls as stubs now; do NOT reach into Redis before Phase 07 wires `app/core/cache.py`.

## Test (final task of this phase — written in context)
- `backend/tests/test_rbac.py`: **RBAC denial.** A CSM cannot read another CSM's customer — `csm` GET `csm2`'s customer → 403; `csm` GET own → 200; manager GET any → 200; `csm` DELETE → 403, admin DELETE → 204; `csm` POST with another `owner_id` → 403, with `owner_id` omitted → 201 self-owned. Uses the Phase 03 `conftest.py` fixtures. Fixtures: `admin`/`manager`/`csm`/`csm2` + tokens, a customer owned by `csm` and one by `csm2`.
