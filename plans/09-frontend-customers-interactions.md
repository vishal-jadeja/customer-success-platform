# Phase 09 — Frontend Customers + Interactions Screens

## Objective
Once done: users can browse a filtered, sorted, paginated customer list, open a customer detail page showing the owner and its interactions, create/edit customers, and — every interaction capability the PDF lists — **browse a filtered interaction list, open an interaction detail page, create and edit interactions** — all via Redux Toolkit thunks with normalised slices, zod-validated forms mirroring the backend, and role-gated action buttons.

## Depends on
Phase 08, Phase 04, Phase 05.

## Estimated time
1h45.

## Files created or modified
```
frontend/
  store/slices/customersSlice.ts     # entities/ids + status/error + filters
  store/slices/interactionsSlice.ts
  schemas/customer.ts                 # zod mirror
  schemas/interaction.ts
  app/(app)/customers/page.tsx        # list
  app/(app)/customers/[id]/page.tsx   # detail + interactions
  app/(app)/customers/new/page.tsx
  app/(app)/customers/[id]/edit/page.tsx
  app/(app)/interactions/page.tsx          # global list + filter bar
  app/(app)/interactions/[id]/page.tsx     # detail: fields + InsightPanel (Phase 10) + Edit button
  app/(app)/interactions/[id]/edit/page.tsx
  app/(app)/interactions/new/page.tsx      # create (customer preselectable via ?customer_id=)
  components/interactions/InteractionFilters.tsx
  components/customers/CustomerTable.tsx
  components/customers/CustomerForm.tsx
  components/interactions/InteractionForm.tsx
  components/interactions/InteractionList.tsx
  components/common/Pagination.tsx, Filters.tsx, RoleGate.tsx
```

## Tasks
1. `customersSlice`: normalised `{ entities, ids, total, page, page_size, status, error, filters }`. Thunks `fetchCustomers(params)`, `fetchCustomer(id)`, `createCustomer`, `updateCustomer`, `deleteCustomer`. Selectors for list + by-id.
2. `interactionsSlice`: same shape; thunks `fetchInteractions(params)`, `fetchForCustomer(id)`, `fetchInteraction(id)`, `createInteraction`, `updateInteraction` (regenerate added in Phase 10).
3. zod schemas mirror Pydantic (status enum, health 0–100, email, notes min 20). Reuse in forms.
4. Customer list page: filter bar (q, status, industry, health range), sort dropdown, pagination, row click → detail. Loading/empty/error states from slice status.
5. Detail page: customer fields (incl. owner), interaction list, buttons (New interaction; Edit/Delete gated by role via `RoleGate`).
6. Create/edit customer form: react-hook-form + zodResolver; owner selector shown only to admin/manager.
7. Interaction create form: customer preselected on detail page; notes textarea with min-length hint.
8. Interaction list page: `InteractionFilters` (customer, type, date from/to, sentiment) + pagination; row click → detail. Mirrors the backend filter params exactly.
9. Interaction detail page: title/type/customer link/occurred_at/duration/notes, the insight panel slot (filled in Phase 10), Edit button gated to author/manager/admin.
10. Interaction edit page: same `InteractionForm` in edit mode (`PATCH`); changing `notes` does **not** auto-regenerate the insight — the detail page's Regenerate button does that explicitly (stated in the UI).
11. `RoleGate` component: renders children only if `user.role` in allowed set (author checks are done in-component: `interaction.user_id === user.id`).

## Error handling requirements
- API 403 → inline "You don't have access" state, not a crash.
- 409 (duplicate email) → map to the email field error.
- 422 field errors from backend → surface under the matching form fields (backend `details`).
- Optimistic vs pessimistic: keep pessimistic (await thunk, then update) to avoid stale UI; show spinners.
- List thunk failure sets slice `status=failed` + `error`; page shows retry.

## Acceptance criteria
- Filters + sort + pagination all issue correct query params and update the list.
- CSM sees only owned customers; no Delete button for CSM/manager where matrix forbids.
- Creating a customer as CSM omits owner selector and the created customer is self-owned.
- Duplicate email shows a field-level error, not a generic toast.
- Interaction list filters by type + date range and paginates; detail page opens; edit as the author saves and re-renders; a non-author CSM sees no Edit button and gets an inline 403 if they hit the route directly.

## Verification
- Manual across roles: log in as admin, manager, csm; confirm list scoping, button visibility, form validation (submit invalid → zod errors; submit dup email → field error).

## Known pitfalls
- **Mirror validation, don't diverge:** the zod schema must match Pydantic bounds exactly, or the client accepts what the server rejects (confusing 422s).
- **Normalised shape:** store by id; derive arrays via selectors — don't keep parallel arrays that drift.
- **`createAsyncThunk` error payload:** use `rejectWithValue(err.response.data.error)` so components can read the envelope, not a generic message.
- **Stale detail after edit:** re-fetch or update the entity in the slice after `updateCustomer` fulfils.
- **Role gating is UX only** — the backend still enforces; never rely on hiding a button for security.
