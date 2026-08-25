# Phase 08 — Frontend Foundation

## Objective
Once done: a Next.js (App Router, TS, Tailwind) app boots with a configured Redux Toolkit store (typed hooks, auth slice with normalised shape + status/error), a shared axios instance with a **relative** `baseURL='/api/v1'` (all traffic goes through the Next.js proxy rewrite, so the cookie is first-party and `withCredentials` is unnecessary) that attaches the in-memory access token and transparently refreshes on 401, working login/register pages (react-hook-form + zod), an `AuthGuard` that silently refreshes on mount, a role-aware app shell, and a **profile page** (the PDF's "Profile" capability: view + edit name/password against `GET/PATCH /auth/me`). Auth survives a hard refresh. The `next.config.js` rewrite established at the Phase 03 skeleton is carried in here.

## Depends on
Phase 03 (auth API + the first deploy, which already proved the first-party cookie round-trip through the proxy).

## Estimated time
1h45 (incl. profile page).

## Files created or modified
```
frontend/
  app/(auth)/login/page.tsx
  app/(auth)/register/page.tsx
  app/(app)/layout.tsx            # AuthGuard + shell
  app/(app)/profile/page.tsx      # view + edit full_name / change password (PATCH /auth/me)
  app/layout.tsx                  # Providers
  lib/axios.ts
  next.config.js                  # rewrite /api/v1/:path* -> ${BACKEND_URL}/api/v1/:path* (carried from Phase 03 skeleton)
  store/index.ts                  # configureStore
  store/hooks.ts                  # typed useAppDispatch/Selector
  store/slices/authSlice.ts
  components/AuthGuard.tsx
  components/AppShell.tsx
  schemas/auth.ts                 # zod (login, register, profileUpdate)
  providers.tsx                   # Redux Provider (client)
```

## Tasks
1. `create-next-app` with TS + Tailwind + App Router. Confirm `next.config.js` has the proxy rewrite (from the Phase 03 skeleton) and, for Phase 11, `output: 'standalone'`. **The rewrite destination is resolved at `next build` time** — `BACKEND_URL` must exist in the build environment (Vercel env, or a Docker build `ARG` in Phase 11). It is not read per request.
2. `lib/axios.ts`: instance with **`baseURL='/api/v1'` (relative — never an absolute backend URL)**. **No `withCredentials`** — same-origin cookies are sent by default, and the proxy makes every call same-origin. **Timeouts:** global `timeout: 15000` (15s); override to `45000` (45s) per-request on `POST /interactions` and `POST /interactions/{id}/insight/regenerate` (server budget is 35 s, see Phase 06); override to **`60000` on the mount-time silent refresh only** — Render free tier cold-starts in ~50 s and a 15 s timeout there bounces the first visitor to `/login` and makes the app look broken. Show a "Waking up the server…" banner while that first refresh is in flight for > 3 s. Request interceptor injects `Authorization: Bearer ${accessToken}` from an in-memory holder (module var + Redux). Response interceptor: on 401 (not the refresh call itself), call `/auth/refresh` once with **single-flight** (share one in-flight promise), update token, retry queued requests; on refresh failure dispatch logout + redirect to /login.
3. `store/index.ts` + `store/hooks.ts`: `configureStore`, `RootState`, `AppDispatch`, typed hooks.
4. `authSlice.ts`: state `{ user, accessToken, status, error }`. Thunks: `login`, `register`, `fetchMe`, `refresh`, `logout`. Store access token in memory (Redux), NOT localStorage.
5. `schemas/auth.ts`: zod for login/register mirroring backend (email, password 8–72, full_name). Use with react-hook-form `zodResolver`.
6. Login/register pages: forms, field errors from zod, submit dispatches thunk, redirect on success.
7. `AuthGuard`: on mount, if no access token, attempt `refresh` (cookie-based); success → `fetchMe`; on 401 with `code=REFRESH_RACE` (another tab rotated the cookie first — see Phase 03 grace window) **retry `refresh` once after ~300 ms** (the cookie jar now holds the new cookie); any other failure → redirect /login. Render children only when authenticated.
8. `AppShell`: nav with role-aware links (Customers, Interactions, Dashboard, Profile; **Users only if the optional Phase 10 users page ships** — never a dead link). Logout button.
9. Profile page: shows email/role (read-only) + form for `full_name` and optional password change (`current_password`, `new_password` 8–72) → `PATCH /auth/me`, then `fetchMe`. zod mirror of `MeUpdateIn`.

## Error handling requirements
- 401 on any call → single silent refresh attempt; on failure → logout + redirect, no infinite loop (guard the refresh endpoint from its own interceptor).
- Network error / backend down → surface a toast/inline error, keep the app usable.
- Refresh single-flight: concurrent 401s must trigger exactly one refresh, not N.
- Zod validation errors render per-field before any request is sent.

## Acceptance criteria
- Register → auto-login → land on dashboard.
- Hard refresh (F5) keeps the user logged in (silent refresh from cookie).
- Expiring the access token (or waiting past TTL) → next call transparently refreshes and succeeds.
- Logout clears memory + cookie and redirects to /login; protected routes then redirect to /login.
- A CSM does not see the Users nav item (if present at all).
- Profile page updates name → header reflects it without reload; wrong current password → field error from the 401/422 envelope.
- With the backend deliberately paused, first load shows the waking banner instead of a login bounce.
- Opening the app in two tabs at once (both cold) leaves both logged in — the `REFRESH_RACE` retry absorbs the collision.

## Verification
- Manual: login, F5, observe still authenticated; DevTools → Application → no token in localStorage; Network shows one `/auth/refresh` on concurrent 401s.

## Known pitfalls
- **Access token in localStorage defeats the whole auth design** — keep it in memory only. Persistence comes from the refresh cookie + silent refresh.
- **Interceptor recursion:** exclude `/auth/refresh` and `/auth/login` from the 401-refresh logic or you loop.
- **No `withCredentials`, no absolute backend URL.** All calls go to `/api/v1/*` on the Vercel origin and Next.js proxies them to the backend server-side, so the cookie is first-party and travels automatically. An absolute backend `baseURL` would reintroduce the cross-site cookie problem and leak the Render URL. Backend CORS is no longer load-bearing.
- **Timeout traps:** the 15s global default will abort a `POST /interactions` that waits on Groq→Cerebras failover — set the 45s per-request override on the create + regenerate calls, and keep each LLM provider capped at 15s server-side so total fan-out stays under 45s.
- **App Router client boundaries:** Redux Provider and hooks are client components (`"use client"`). Keep the store provider in a `providers.tsx` wrapper.
- **Hydration:** don't read the token during SSR; gate authed UI behind the client-side guard.
