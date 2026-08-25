"""FastAPI application entrypoint.

``create_app()`` is the factory; the module-level ``app`` it builds is what
``uvicorn app.main:app`` imports. Routers, DB/Redis wiring, error handlers,
and request-id middleware are added in later phases.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="CSP API", version="0.1.0")

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

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        # Static OK for now. DB SELECT 1 + Redis PING are wired in Phase 02/03.
        return {"status": "ok"}

    return app


app = create_app()
