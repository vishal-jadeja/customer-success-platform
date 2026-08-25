# Phase 09 — Frontend Customers + Interactions Screens

## Objective
Once done: users can browse a filtered, sorted, paginated customer list, open a customer detail page showing the owner and its interactions, create/edit customers, and create interactions — all via Redux Toolkit thunks with normalised slices, zod-validated forms mirroring the backend, and role-gated action buttons.

## Depends on
Phase 08, Phase 04, Phase 05.

## Estimated time
1h30.

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
  app/(app)/interactions/page.tsx     # global list
  components/customers/CustomerTable.tsx
  components/customers/CustomerForm.tsx
  components/interactions/InteractionForm.tsx
  components/interactions/InteractionList.tsx
  components/common/Pagination.tsx, Filters.tsx, RoleGate.tsx
```

## Tasks
1. `customersSlice`: normalised `{ entities, ids, total, page, page_size, status, error, filters }`. Thunks `fetchCustomers(params)`, `fetchCustomer(id)`, `createCustomer`, `updateCustomer`, `deleteCustomer`. Selectors for list + by-id.
2. `interactionsSlice`: same shape; thunks for global list, per-customer list, create.
3. zod schemas mirror Pydantic (status enum, health 0–100, email, notes min 20). Reuse in forms.
4. Customer list page: filter bar (q, status, industry, health range), sort dropdown, pagination, row click → detail. Loading/empty/error states from slice status.
5. Detail page: customer fields (incl. owner), interaction list, buttons (New interaction; Edit/Delete gated by role via `RoleGate`).
6. Create/edit customer form: react-hook-form + zodResolver; owner selector shown only to admin/manager.
7. Interaction create form: customer preselected on detail page; notes textarea with min-length hint.
8. `RoleGate` component: renders children only if `user.role` in allowed set.

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

## Verification
- Manual across roles: log in as admin, manager, csm; confirm list scoping, button visibility, form validation (submit invalid → zod errors; submit dup email → field error).

## Known pitfalls
- **Mirror validation, don't diverge:** the zod schema must match Pydantic bounds exactly, or the client accepts what the server rejects (confusing 422s).
- **Normalised shape:** store by id; derive arrays via selectors — don't keep parallel arrays that drift.
- **`createAsyncThunk` error payload:** use `rejectWithValue(err.response.data.error)` so components can read the envelope, not a generic message.
- **Stale detail after edit:** re-fetch or update the entity in the slice after `updateCustomer` fulfils.
- **Role gating is UX only** — the backend still enforces; never rely on hiding a button for security.
