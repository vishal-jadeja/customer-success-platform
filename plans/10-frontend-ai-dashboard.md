# Phase 10 — Frontend AI Insight Panel + Dashboard

## Objective
Once done: each interaction shows an AI insight panel (summary, sentiment badge, action items, key risks) with distinct pending/completed/failed states and a Retry button wired to regenerate; the dashboard page renders KPI cards plus Recharts visualisations (sentiment trend, at-risk customers) scoped to the user, with proper loading/empty/error handling.

## Depends on
Phase 09, Phase 06, Phase 07.

## Estimated time
1h30 (1h without the optional Users page).

## Files created or modified
```
frontend/
  store/slices/dashboardSlice.ts
  components/insights/InsightPanel.tsx
  components/insights/SentimentBadge.tsx
  app/(app)/dashboard/page.tsx
  components/dashboard/KpiCards.tsx
  components/dashboard/SentimentTrendChart.tsx   # Recharts
  components/dashboard/AtRiskList.tsx
  app/(app)/users/page.tsx                        # OPTIONAL, last task, first to cut — admin/manager list + admin role select
  store/slices/usersSlice.ts                      # OPTIONAL
```

## Tasks
1. `InsightPanel`: mounted on the **interaction detail page** (Phase 09) and inline under each row on the customer detail page. Reads the interaction's `insight` (a row always exists from create — see Phase 05/06). States:
   - `completed` → summary text, `SentimentBadge`, action items list, risks list.
   - `failed` → error message + "Regenerate" button (dispatch regenerate thunk).
   - `pending` → "Generating…" (transient; inline sync generation means the create response is usually already `completed`/`failed`, but regenerate briefly re-enters `pending`).
   - `null` → defensive only (row should always exist); render the same as `pending`.
2. Regenerate thunk in `interactionsSlice`: `POST /interactions/{id}/insight/regenerate`, update the interaction entity on fulfil.
3. `SentimentBadge`: colour-coded (positive/neutral/negative).
4. `dashboardSlice`: thunks `fetchSummary`, `fetchSentimentTrend(days)`, `fetchAtRisk`. status/error each.
5. Dashboard page: `KpiCards` (total customers, ARR, avg health, at-risk count, interactions 30d), `SentimentTrendChart` (Recharts LineChart/AreaChart over days×sentiment), `AtRiskList`.
6. Loading skeletons, empty states (zeros/empty arrays render cleanly), error retry.
7. **Optional — Users admin page** (`/users`): table from `GET /users`; admin gets a role `<select>` → `PATCH /users/{id}` and a deactivate toggle. Only when this ships does the "Users" nav link appear (Phase 08). This is cut-order item 2; skip it without guilt if the schedule has slipped.

## Error handling requirements
- Insight `failed` → show `error_message`, offer Retry; never a blank panel.
- Regenerate in-flight → disable button + spinner; on failure keep failed state with a toast.
- Dashboard thunk failure → card/chart shows error + retry, other cards still render independently.
- Charts must handle empty data (no rows) without throwing.

## Acceptance criteria
- Creating an interaction shows a completed insight panel with all four sections populated.
- A failed insight (forced) shows the failed state + Retry; clicking Retry (with valid keys) flips it to completed without reload.
- Dashboard KPI cards show numbers; sentiment trend chart renders; at-risk list populated from seed.
- CSM dashboard reflects only their book (smaller numbers than admin).

## Verification
- Manual: create interaction → see insight; force-fail then retry; open dashboard as admin vs csm and compare figures; empty-state check on a fresh CSM with no data.

## Known pitfalls
- **Recharts + Next App Router:** chart components must be client (`"use client"`) and often need a fixed-height `ResponsiveContainer` parent or they render 0px tall.
- **Sentiment colour mapping:** centralise the enum→colour map; don't inline three different versions.
- **Insight is a real state machine, not null-on-failure.** The row is committed with the interaction (Phase 05), so after create the insight is `completed` or `failed`, never null; `failed` is a first-class state with a Retry, not an error to swallow. Treat a null defensively (render as pending) but don't design around it.
- **Don't refetch the whole list to update one insight** — update the single entity from the regenerate response.
- **Number formatting:** ARR as currency, health as int; guard against null/0.
