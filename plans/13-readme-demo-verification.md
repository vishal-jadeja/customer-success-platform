# Phase 13 — README, Demo-Video Script, Final Verification

## Objective
Once done: the repo has a README covering setup, architecture, and the design decisions (lifted from the master plan), both live URLs and seeded demo credentials (at the top) are documented, a demo video is recorded following a tight script that shows every graded module, and a final pass confirms every feature works on the live URLs.

## Depends on
Phase 12 (live URLs). The critical tests already live in Phases 03/04/06/07 (there is no separate test phase) and should be green.

## Estimated time
1h.

## Files created or modified
```
README.md
docs/architecture.md (optional; or a section in README)
.env.example (final review)
```

## Tasks
1. **README** sections (in this order):
   - **Demo credentials — at the very top, above setup.** The three seeded logins, one per role (admin / manager / csm), with their throwaway passwords, so a grader can log straight into a populated account. One-line note: *"Registering a new account creates an empty `csm` account by design — use the demo logins above to see populated data."* A fresh registration lands on an empty dashboard and can otherwise read as broken.
   - Overview + live URLs (frontend, backend).
   - Quick start: local (`docker compose up`, seed, open localhost:3000) and env table (every var, purpose, example — including `BACKEND_URL` server-side for the proxy; note there is **no** public API-URL var).
   - Architecture: layering diagram (router→service→repository→model), ERD summary, auth flow (first-party cookie via the Next.js reverse proxy), caching strategy, AI pipeline + failover.
   - **Design Decisions & Trade-offs** — paste from master plan (auth + reverse proxy incl. the CSRF-via-`SameSite=Lax` line, role-read-from-DB line and the 10 s refresh-reuse grace window; two-level RBAC / ownership; sync SQLAlchemy; version-key cache **incl. the namespace-global "coarse-grained but correct" note**; inline-resilient AI with the 35 s total budget; testing scope) **plus the "What I'd build next" Account-Team paragraph**.
   - Note that the app boots and works **without LLM keys** (insights show `failed: no LLM provider configured`) so a grader can run Compose immediately, and that `BACKEND_URL` is a build-time value for the frontend image.
   - Scope: an honest account — core RBAC/CRUD/AI/dashboard/cache/deploy delivered; the Account-Team access model was deliberately left out (see "What I'd build next"); frontend vitest deliberately out. State the realistic-scope framing, not a "cut nothing" claim.
   - Testing: how to run pytest + what's covered (the 4–6 in-phase tests).
2. **Demo script** (record ~4–6 min):
   1. Login as admin → dashboard (global KPIs, charts) → open Profile, change display name.
   2. Login as csm → dashboard scoped smaller; customer list scoped.
   3. Create a customer; show validation (client + server) on a bad field.
   4. Create an interaction with meeting notes → AI insight appears (summary/sentiment/actions/risks). Open the interaction list, filter by type/date, open the detail page, edit the title.
   5. Show failover story (mention Groq→Cerebras) and the failed→Retry path (or curl regenerate).
   6. Show RBAC: csm blocked from another csm's customer (403); manager reassigns `owner_id` → the customer moves into that csm's scope.
   7. Show caching: dashboard hit/miss in backend logs; a write invalidates and refreshes numbers. Name the limitation out loud: namespace-global invalidation — *"coarse-grained but correct; per-scope counters if write volume grew."*
   8. Mention refresh-token rotation + reuse detection, the first-party-cookie-via-proxy design, and `slowapi` login rate-limiting as the security highlights.
3. **Final verification pass:** walk every acceptance criterion from Phases 03–10 against the LIVE URLs; fix anything broken; warm Render before recording.

## Error handling requirements
- README must state the Render free-tier cold-start caveat so a grader isn't misled by a slow first load.
- Ensure no secret is present anywhere in the repo or README (only `.env.example` placeholders).

## Acceptance criteria
- README lets a fresh reader run the project locally and understand the architecture without asking questions.
- Both live URLs work in incognito; demo credentials log in.
- Video shows every graded module: auth+RBAC, customers, interactions, AI insight + fallback, dashboard, caching, deployment.
- Design decisions section maps each ambiguous spec point to a recorded choice + rationale.

## Verification
```
# fresh-clone sanity
git clone <repo> tmp && cd tmp && cp .env.example .env  # fill values
docker compose up -d && docker compose exec backend python scripts/seed.py
# open localhost:3000, log in
# live:
open https://<vercel-app>  # log in with documented creds, run the demo script
```

## Known pitfalls
- **Warm the backend** (hit /healthz) right before recording or the first login looks broken (cold start).
- **Don't commit secrets** — double-check git history; if a key leaked, rotate it.
- **Credentials in README** should be seeded demo accounts with throwaway passwords, clearly marked demo-only, and placed **above** the setup steps.
- **Keep the video tight** — rehearse once; a rambling video buries the graded features.
- **Ship complete over ambitious.** If the schedule slips, execute the master-plan cut order (sentiment-trend chart → optional Users page → customer-edit polish; never a PDF-listed capability or the Docker setup) rather than leaving a graded deliverable half-built. A complete modest build outscores an unfinished ambitious one.
