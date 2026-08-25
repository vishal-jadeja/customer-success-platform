"""FastAPI application entrypoint.

``create_app()`` is the factory; the module-level ``app`` it builds is what
``uvicorn app.main:app`` imports.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.routers import auth, customers, interactions, users
from app.core.config import get_settings
from app.core.errors import envelope, register_error_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestIDMiddleware
from app.core.ratelimit import limiter
from app.core.redis import safe_ping
from app.db import engine

logger = get_logger(__name__)


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(title="CSP API", version="0.1.0")
    app.state.limiter = limiter
    register_error_handlers(app)

    # CORS is NOT load-bearing: the browser only ever reaches the backend through
    # the same-origin Next.js proxy (see plans/01). This allows Render's /docs to
    # be opened directly cross-origin during development/debugging.
    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Added last => outermost (add_middleware prepends), so every response,
    # including CORS preflights and handled errors, carries X-Request-ID.
    # (Unhandled 500s are built in Starlette's ServerErrorMiddleware, outside
    # this stack — errors.py recovers the id from request.state for those.)
    app.add_middleware(RequestIDMiddleware)

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(customers.router, prefix="/api/v1")
    app.include_router(interactions.router, prefix="/api/v1")
    app.include_router(interactions.customer_router, prefix="/api/v1")

    @app.get("/healthz")
    def healthz(_: Request) -> JSONResponse:
        # DB is load-bearing -> 503 when down. Redis is fail-open -> reported, still 200.
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001 - any driver error means "down"
            logger.error("healthz: database unreachable: %s", exc)
            return envelope(503, "SERVICE_UNAVAILABLE", "Database unreachable")
        redis_ok = safe_ping()
        return JSONResponse({"status": "ok", "db": "ok", "redis": "ok" if redis_ok else "down"})

    return app


app = create_app()
