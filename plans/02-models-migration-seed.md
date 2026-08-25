# Phase 02 — Database Models, Alembic Migration, Seed Script

## Objective
Once done: all five tables (`users`, `refresh_tokens`, `customers`, `interactions`, `insights`) exist as SQLAlchemy 2.0 declarative models and as a hand-verified Alembic migration that applies cleanly to an empty database; a seed script populates realistic users across all three roles, customers spread across owners, interactions, and completed insights — writing insights directly to the DB (`provider='seed'`, no LLM call).

## Depends on
Phase 01.

## Estimated time
1h.

## Files created or modified
```
backend/app/
  db.py                        # engine, SessionLocal, Base, get_db
  models/
    __init__.py                # import all models so Alembic sees them
    enums.py                   # Role, CustomerStatus, InteractionType, Sentiment, InsightStatus
    user.py
    refresh_token.py
    customer.py                # Customer
    interaction.py
    insight.py
  alembic/
    env.py
    versions/0001_initial.py
  alembic.ini                  # finalized
scripts/seed.py
```

## Tasks
1. `app/db.py`: `engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)` (a request holds its pooled connection for the whole ≤35 s LLM call in Phase 06 — bound the pool explicitly and use Neon's pooler URL in prod), `SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)`, `class Base(DeclarativeBase): pass`, and `get_db()` generator (`try: yield db; finally: db.close()`).
2. `models/enums.py`: Python `enum.Enum` classes matching the ERD. Use `str, enum.Enum` mixin so values serialize cleanly.
3. Models with `Mapped[...]` / `mapped_column(...)`. UUID PKs default `uuid.uuid4`. Timestamps `server_default=func.now()`, updated_at `onupdate=func.now()`. Add all indexes and the `health_score` CHECK constraint. `customers.owner_id` is `ON DELETE RESTRICT`. Relationships: `Customer.owner`, `Customer.interactions`; `Interaction.insight` (uselist=False).
4. `models/__init__.py` imports every model so `Base.metadata` is complete for autogenerate.
5. `alembic init app/alembic`; edit `env.py` to `from app.models import *` / import `Base`, set `target_metadata = Base.metadata`, and read `settings.DATABASE_URL` (not the ini literal).
6. `alembic revision --autogenerate -m "initial"`. **Open the generated file and verify** each enum has an explicit `sa.Enum(..., name=...)` and that Postgres `CREATE TYPE` will run (see pitfalls). Add `create_type=True` / manual `op.execute` if missing.
7. `alembic upgrade head` against the compose Postgres.
8. `scripts/seed.py`: create ~6 users (1 admin, 2 managers, 3 csm), ~15 customers spread across owners and statuses, ~40 interactions, and one `insights` row per interaction with `status=completed`, `provider='seed'`, `latency_ms=NULL`, and plausible summary/sentiment/action_items/risks written directly (no LLM). Seeded rows must not impersonate a real provider — `provider='seed'` so anyone opening the DB sees nothing to explain away. Hash passwords with the Phase 03 helper (or inline bcrypt if 03 not done — refactor later). Make it idempotent (check-or-skip by email).

## Error handling requirements
- Seed run twice must not crash on unique-email violation: wrap in a "exists?" check or catch `IntegrityError`, rollback, skip.
- Migration must be reversible: `downgrade()` drops tables **and** the enum types (`op.execute("DROP TYPE ...")`), or `alembic downgrade base` will fail on a second `upgrade`.

## Acceptance criteria
- `alembic upgrade head` on an empty DB succeeds; `\dt` shows five tables and `\dT` shows all enum types.
- `alembic downgrade base` then `upgrade head` both succeed (round-trip clean).
- `python scripts/seed.py` twice: first populates, second is a no-op, neither crashes.
- Every seeded insight has `provider='seed'` and `latency_ms IS NULL`.

## Verification
```
docker compose up -d postgres
cd backend && alembic upgrade head
alembic downgrade base && alembic upgrade head
python scripts/seed.py && python scripts/seed.py
psql $DATABASE_URL -c "select count(*) from insights where provider <> 'seed' or latency_ms is not null;"
# ^ must return 0
```

## Known pitfalls
- **Alembic + enums (the classic trap):** on the FIRST migration, autogenerate creates columns of an enum type but may NOT emit `CREATE TYPE`, or emits it with `checkfirst=False` so a re-run explodes. Inspect the migration; ensure each `sa.Enum(name="...")` will create the type, and that `downgrade` drops it. Test the round-trip in acceptance above.
- **`server_default=func.now()` vs Python default:** use `server_default` so raw SQL inserts (seed via ORM is fine) still get timestamps.
- **UUID default:** pass the callable `default=uuid.uuid4`, not `uuid.uuid4()` (which would freeze one value for all rows).
- **`str, Enum` mixin ordering:** `class Role(str, enum.Enum)` — str first — or JSON serialization gives `Role.admin` instead of `"admin"`.
- Don't let the seed call the LLM — it will hit Groq rate limits and be slow. Write `status=completed` insights directly.
