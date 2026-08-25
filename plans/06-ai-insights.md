# Phase 06 — AI Insights Pipeline (Groq primary, Cerebras failover)

## Objective
Once done: submitting an interaction generates a structured insight (summary, sentiment, action items, key risks) inline. The `pending` insight row committed alongside the interaction in Phase 05 is **updated** here to `completed`/`failed` — this phase no longer creates the row. Groq is tried first, Cerebras on failure, via one `LLMProvider` protocol. Responses are parsed defensively and validated; the raw response, status, provider, model, and any error are persisted. A failed generation never blocks or rolls back the interaction — the endpoint returns 201 with the insight showing `status='failed'` — and a regenerate endpoint retries.

## Depends on
Phase 05.

## Estimated time
1h15.

## Files created or modified
```
backend/app/schemas/insight.py     # InsightPayload (LLM contract), InsightOut
backend/app/llm/base.py            # LLMProvider protocol, LLMResult, LLMError types
backend/app/llm/groq.py
backend/app/llm/cerebras.py
backend/app/llm/client.py          # FailoverLLMClient + parse chain + repair
backend/app/llm/prompts.py
backend/app/services/insight_service.py
backend/app/services/interaction_service.py   # wire create -> generate
backend/app/api/v1/routers/interactions.py    # regenerate endpoint
```

## Tasks
1. `schemas/insight.py`: `InsightPayload` (`summary: str`, `sentiment: Literal[...]`, `action_items: list[str]`, `risks: list[str]`) with a validator lowercasing sentiment and mapping unknown → `neutral`. `InsightOut` exposes stored fields incl. `status`, `provider`, `error_message`.
2. `llm/base.py`: `class LLMProvider(Protocol)` with `name: str` and `complete(system, user, *, timeout) -> str` (returns raw content). `LLMResult` dataclass (content, provider, model, latency_ms).
3. `llm/groq.py` / `llm/cerebras.py`: httpx POST to the OpenAI-compatible `/chat/completions`, `response_format={"type":"json_object"}`, `temperature=0.2`, model+key+base_url from settings. **Pass `timeout=LLM_TIMEOUT_SECONDS` (15s) explicitly per provider** so a hung provider can't block a threadpool worker; two providers × 15s = ≤30s worst-case fan-out, safely under the 45s per-request frontend cap on `POST /interactions`. Raise typed errors for timeout / http status.
4. `llm/client.py`: `FailoverLLMClient(providers)` iterates in `LLM_PROVIDER_ORDER`, each call capped at 15s. For each: call, then parse chain: `json.loads` → fenced ```json extract + retry → one repair call ("return ONLY valid JSON matching this schema: ...") → next provider. On success validate with `InsightPayload`. Returns `(payload, provider, model, latency, raw)` or raises `ExternalServiceError` when all exhausted.
5. `llm/prompts.py`: system prompt (role: CS analyst; output contract; JSON only) + user template embedding truncated notes (≤8000 chars) and customer context (name, status).
6. `insight_service.py`:
   - `generate_for_interaction(db, interaction)`: **load the existing `pending` insight row** (created in Phase 05's create transaction), `attempts+=1`. If `AI_ENABLED` false → `status=failed`, `error_message='AI disabled'`, commit, return. Call client; on success fill fields, `status=completed`; on `ExternalServiceError` → `status=failed`, `error_message`, `raw_response`=last body. Commit the insight row (second commit, separate from the interaction). Invalidate interactions+dashboard cache (stub until 07).
   - `regenerate(db, user, interaction_id)`: access check, reset the row to `pending`, re-run generate.
7. Wire `interaction_service.create`: the interaction + `pending` insight are already committed (Phase 05) → call `generate_for_interaction` in a `try/except` that can never propagate to a 5xx. Return the interaction with its `insight` (now `completed` or `failed` — never null, since the row exists).
8. Add `POST /interactions/{id}/insight/regenerate` (roles per matrix).

## Error handling requirements
| Failure | Behaviour |
|---|---|
| `httpx.TimeoutException` | log WARN + request id + provider; advance to next provider |
| HTTP 429 / 5xx | log WARN; advance |
| HTTP 401/403 (bad key) | log ERROR "bad credentials {provider}"; advance; never retry same |
| `json.JSONDecodeError` | fenced-block extract → repair call → else next provider |
| `pydantic.ValidationError` | repair call → else next provider |
| all providers exhausted | insight `status=failed`, `error_message` set, `raw_response`=last raw, `attempts` incremented; interaction still 201, insight present with `status='failed'` |
| `AI_ENABLED=false` | skip calls; `status=failed`, `error_message='AI disabled'` |
| unexpected exception during generation | caught in `interaction_service.create`; interaction still returned; insight `status=failed` |

**Absolute rule:** the interaction **and its `pending` insight row** are committed together (Phase 05) before any LLM call; AI failure updates only that insight row (a second commit) and never rolls back or 5xxes the create.

## Acceptance criteria
- Happy path: create interaction → response includes `insight.status="completed"` with non-empty summary, a valid sentiment, and lists.
- Forcing Groq to fail (bad `GROQ_API_KEY`) still returns a completed insight via Cerebras, with `insight.provider="cerebras"`.
- Forcing both to fail returns 201 with the insight showing `status="failed"` and an `error_message` (the row exists from create — it is not null).
- Feeding a prompt that yields non-JSON triggers the repair path (observable in logs); if unrecoverable → status failed, not a 500.
- `regenerate` on a failed insight can flip it to completed once keys are valid.

## Verification
```
# happy path
curl -s -X POST :8000/api/v1/interactions -H "authorization: Bearer $CSM" -H 'content-type: application/json' \
  -d '{"customer_id":"'$OWN'","type":"call","title":"Renewal","notes":"Customer worried about pricing and slow onboarding, but likes support.","occurred_at":"2026-08-20T10:00:00Z"}' | jq .insight
# failover: set GROQ_API_KEY=bad, restart, repeat -> insight.provider == "cerebras"
# total failure: both keys bad -> .insight.status == "failed", then:
curl -s :8000/api/v1/interactions/$IID -H "authorization: Bearer $CSM" | jq '.insight.status,.insight.error_message'
# regenerate after fixing keys
curl -s -X POST :8000/api/v1/interactions/$IID/insight/regenerate -H "authorization: Bearer $CSM" | jq .status
```

## Known pitfalls
- **Never let AI failure 500 the create.** The single most-graded behaviour. Wrap generation; commit interaction first.
- **`response_format=json_object` isn't a guarantee** on free-tier models — keep the parse chain + repair call; don't assume clean JSON.
- **Timeout must be bounded** (`LLM_TIMEOUT_SECONDS`) or a hung provider blocks a threadpool worker. Pass `timeout=` to httpx explicitly.
- **Truncate notes** before prompting (8000 chars) to avoid context-limit errors on free models.
- **Sentiment normalisation:** models return "Positive"/"POSITIVE"/"mixed". Lowercase; map unknown → neutral in the validator, don't 500.
- **Persist raw_response even on success** is optional but persist it on failure — it's your debugging lifeline and a spec requirement.
- **Don't call the LLM inside the DB transaction** that holds the interaction/pending-insight insert; that transaction is already committed in Phase 05's create. Load the pending row, call the LLM, then a second commit updates the row to completed/failed.

## Test (final task of this phase — written in context)
- `backend/tests/test_ai.py`: **provider failover + malformed-JSON repair.** Monkeypatch `GroqProvider.complete` and `CerebrasProvider.complete` (the provider boundary, not httpx). First provider raises, second returns valid JSON → insight `completed` with `provider="cerebras"`. Both fail → interaction created 201, insight `status="failed"` persisted (row exists, not null), no 5xx. A provider returns non-JSON then the repair call also fails → `status="failed"`, not a 500. No test performs a real external HTTP call.
