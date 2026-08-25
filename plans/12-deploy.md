# Phase 12 — Re-deploy + Verify (Render, Vercel, Neon, Upstash)

## Objective
The stack was **already stood up on the deployed URLs at the end of Phase 03** (skeleton backend on Render + Neon + Upstash, minimal frontend on Vercel with the proxy rewrite, one login round-trip verified). This phase is a **re-deploy-and-verify pass**, not a first attempt: push the now-complete backend and full frontend, run the seed against the prod DB, and walk every graded module against the live URLs. The first-party cookie flow through the Next.js proxy was proven in Phase 03, so there is no cross-site cookie debugging left to do.

## Depends on
Phase 11 (full apps + Dockerfiles) and the Phase 03 deploy (Render/Vercel/Neon/Upstash already provisioned and wired).

## Estimated time
45m.

## Files created or modified
```
render.yaml (optional)
README.md (env + URLs — finalized in Phase 13)
# no app code except CORS origin + cookie config confirmations
```

## Tasks
1. **Neon / Upstash:** already provisioned in Phase 03. Confirm `DATABASE_URL` (pooled, `sslmode=require`) and `REDIS_URL` (`rediss://` TLS) are still set; run `alembic upgrade head` to apply any migrations added since the skeleton.
2. **Render backend:** redeploy the now-complete backend on the **native Python runtime** set up in Phase 03 (build `pip install .`, start `alembic upgrade head && uvicorn …`); the Dockerfile is for Compose, not Render. Env vars: JWT_SECRET, DATABASE_URL, REDIS_URL, GROQ/CEREBRAS keys+models, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`. `CORS_ORIGINS` stays minimal (own-origin only) — not load-bearing, since the browser reaches the backend only through the Vercel proxy. Release/start command applies migrations.
3. **Vercel frontend:** redeploy the full frontend. Ensure `BACKEND_URL=<render backend url>` is set as a **server-side** env (NOT `NEXT_PUBLIC_`) so the `next.config.js` rewrite proxies `/api/v1/*` to Render. There is no public API-URL var.
4. **Seed prod:** run `python scripts/seed.py` **locally** with `DATABASE_URL` pointed at Neon (Render's free tier has no shell / one-off jobs). Unset it again afterwards.
5. **Cookie confirm:** `Set-Cookie` on login has `Secure; SameSite=Lax`, no `Domain`, and the browser stores it against the **Vercel** origin (first-party). Confirm no browser request goes to the Render domain.
6. **End-to-end check** across all three roles.

## Error handling requirements
- Missing prod env var → backend fails fast at boot (Settings validation) — check Render logs first on any 500.
- Missing/wrong `BACKEND_URL` on Vercel → the proxy 502s or 404s `/api/v1/*`; check it is set server-side and points at the Render URL.
- DB SSL required on Neon → include `sslmode=require`; a plain URL fails to connect.
- Cold start (Render free) → first request slow, not an error. The frontend's mount-time refresh has a 60 s timeout + "Waking up the server…" banner (Phase 08) so the visitor is not bounced to `/login`.

## Acceptance criteria
- Backend `/healthz` on the Render URL → 200 (DB + Redis both reachable).
- Frontend on Vercel loads and login works; F5 keeps session (first-party cookie refresh through the proxy).
- AI insight generation works in prod (keys set), with failover intact.
- Dashboard shows seeded data; cache hit/miss observable in Render logs.
- Both URLs are public and load in an incognito window.

## Verification
```
curl -s https://<render-app>/healthz
# browser: open https://<vercel-app>, log in (seeded user), create interaction -> insight, F5 -> still logged in
# DevTools: /api/v1/* requests go to the Vercel origin; Set-Cookie has Secure; SameSite=Lax; no Domain; no request hits the Render domain
```

## Known pitfalls
- **The cross-site cookie risk is designed away.** The proxy makes the cookie first-party (`SameSite=Lax`, no `Domain`), so there is no `allow_credentials`/exact-origin/`withCredentials` dance and no Safari-ITP failure. Do not reintroduce an absolute backend `baseURL` on the client.
- **`BACKEND_URL` must be server-side on Vercel** (not `NEXT_PUBLIC_`) and set before the deploy that needs it; it feeds the `next.config.js` rewrite at request time.
- **Neon requires SSL** (`sslmode=require`) and uses a pooled endpoint — use the pooler URL for the app.
- **Upstash uses `rediss://` (TLS)** — the redis client must allow TLS.
- **Render free cold starts** (~50s) make the demo look broken — warm the URL right before recording.
- Rotate any API key that ever touched a commit; only `.env.example` is committed.
