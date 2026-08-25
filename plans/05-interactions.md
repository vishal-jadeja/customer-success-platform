# Phase 05 — Interaction Module (CRUD, filters, nested under customer)

## Objective
Once done: interactions can be created (with a `pending` insight row committed alongside them in one transaction; the AI generation that updates that row is wired in Phase 06), listed globally and nested under a customer, filtered, viewed, updated, and deleted, all inheriting the customer scope so a CSM only touches interactions on customers they own.

## Depends on
Phase 04.

## Estimated time
45m.

## Files created or modified
```
backend/app/schemas/interaction.py     # InteractionCreate, InteractionUpdate, InteractionOut (+ nested InsightOut, added in 06)
backend/app/repositories/interaction.py
backend/app/services/interaction_service.py
backend/app/api/v1/routers/interactions.py
backend/app/main.py                     # include router
```

## Tasks
1. `schemas/interaction.py`: create requires `customer_id`, `type`, `title`, `notes` (min 20 chars), `occurred_at`; optional `duration_minutes`. `InteractionOut` carries an `insight` field (present from create as `status='pending'`; shape filled in Phase 06).
2. `repositories/interaction.py`:
   - `list_interactions(db, user, filters, page)` — join to `customers` and apply `apply_customer_scope` on that join so scope is inherited; filters `customer_id`, `type`, `sentiment` (join insight), `date_from`/`date_to` on `occurred_at`, `q` ILIKE title/notes.
   - `list_for_customer(db, user, customer_id, page)`.
   - `get`, `create`, `update`, `delete`.
3. `services/interaction_service.py`:
   - `_assert_can_access` — load the parent customer, reuse `customer_service._assert_can_access`.
   - `create` — verify access to the target customer first; set `user_id=current_user`; **insert the interaction AND a `status='pending'` insight row in the same transaction, then one `commit()`.** The LLM call + status update come in Phase 06 (after this commit). Committing the pending row up front is what makes `pending` a genuine observed state and gives regenerate a real row to act on. **Chosen: this phase creates interaction + pending insight (one transaction, no LLM); Phase 06 wires the generation that updates that row.**
   - `update` — author/manager/admin only; `delete` — manager/admin only.
   - Call `invalidate_interactions()` stub on writes.
4. `api/v1/routers/interactions.py`: endpoints per API table, nested list mounted under customers router or as `/customers/{id}/interactions`.

## Error handling requirements
- Interaction or parent customer not found → `NotFoundError` 404.
- CSM accessing interaction on non-owned/assigned customer → `PermissionDeniedError` 403.
- CSM updating an interaction they did not author → 403.
- `notes` shorter than 20 chars → 422 (mirrors AI-input requirement).
- Invalid `date_from`/`date_to` (unparseable) → 422 via Pydantic.

## Acceptance criteria
- CSM can create an interaction on an owned customer, cannot on a non-owned one (403).
- Nested list `/customers/{id}/interactions` returns only that customer's interactions, scoped.
- Filtering by `type` and date range narrows results correctly.
- Manager can delete any interaction; CSM cannot (403).

## Verification
```
curl -s -X POST :8000/api/v1/interactions -H "authorization: Bearer $CSM" -H 'content-type: application/json' \
  -d '{"customer_id":"'$OWN'","type":"meeting","title":"QBR","notes":"Long enough note about the meeting.","occurred_at":"2026-08-20T10:00:00Z"}'
curl -s ":8000/api/v1/customers/$OWN/interactions" -H "authorization: Bearer $CSM"
curl -si -X DELETE ":8000/api/v1/interactions/$IID" -H "authorization: Bearer $CSM"   # 403
```

## Known pitfalls
- **Scope via join, not a second code path:** the interaction list must reuse `apply_customer_scope` on the joined customer, not reimplement ownership — otherwise the two can drift.
- **`occurred_at` timezone:** store as TIMESTAMPTZ; accept ISO-8601 with offset; Pydantic parses to aware `datetime`. Naive datetimes will bite in the dashboard trend later.
- **Author check for update:** "author" = `interaction.user_id == current_user.id`; don't confuse with customer owner.
- Keep the AI *call* out of this phase — but do create the `pending` insight row in the same transaction as the interaction. No LLM runs here; Phase 06 adds the call that flips `pending → completed/failed`.
