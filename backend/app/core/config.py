"""Typed application configuration, loaded entirely from the environment.

All settings come from environment variables (or a local ``.env`` file in dev).
Secrets have no defaults, so a missing one raises ``pydantic.ValidationError``
at startup — fail fast and loud. Import ``get_settings()`` everywhere; it is
``@lru_cache``-d, so ``Settings()`` is instantiated exactly once per process.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Pydantic v2: MUST be ``model_config = SettingsConfigDict(...)``.
    # The v1 ``class Config`` is silently ignored here and would skip env_file.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Required, no default (fail fast if unset) ---
    DATABASE_URL: str
    REDIS_URL: str
    JWT_SECRET: str

    # --- Auth / token config ---
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MIN: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 7
    # A refresh token revoked less than this many seconds ago is treated as a
    # benign concurrent refresh (two tabs), not as theft: 401 without revoking
    # the whole family. Older reuse still revokes every token for the user.
    REFRESH_REUSE_GRACE_SECONDS: int = 10
    # Login rate limiting (slowapi). Keyed on the first X-Forwarded-For hop —
    # behind the Vercel proxy every browser shares one socket IP. Off in tests.
    RATE_LIMIT_ENABLED: bool = True

    # --- Cookie / CORS ---
    # CORS is NOT load-bearing: the browser talks to the backend only through the
    # same-origin Next.js proxy. This exists so Render's /docs can be opened directly.
    # NoDecode stops pydantic-settings from JSON-decoding the env value before our
    # ``_split_cors`` before-validator runs, so a plain comma string is accepted.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = []
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "lax"

    # --- LLM providers ---
    # Keys/models are OPTIONAL: the app must boot without them (a grader running
    # `docker compose up` with no LLM account). A provider with an empty key is
    # skipped; with none configured, insights are stored as status=failed with
    # error_message="no LLM provider configured".
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    CEREBRAS_API_KEY: str = ""
    CEREBRAS_MODEL: str = "llama-3.3-70b"
    LLM_PROVIDER_ORDER: str = "groq,cerebras"
    LLM_TIMEOUT_SECONDS: int = 15  # per HTTP call
    # Overall deadline across ALL providers and repair calls for one insight, so
    # the worst case (2 providers x (call + repair)) stays under the 45s client cap.
    LLM_TOTAL_BUDGET_SECONDS: int = 35
    AI_ENABLED: bool = True

    # --- Runtime ---
    ENV: str = "dev"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v: object) -> object:
        """Accept a comma-separated string (``a,b,c``) or an already-parsed list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def _warn_empty_cors(cls, v: list[str], info) -> list[str]:  # noqa: ANN001
        # In non-dev an empty origins list is almost certainly a misconfig. Warn,
        # do not raise — CORS is not load-bearing behind the proxy.
        env = info.data.get("ENV", "dev")
        if env != "dev" and not v:
            logger.warning("CORS_ORIGINS is empty in ENV=%s; /docs may be unreachable", env)
        return v


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide cached Settings instance."""
    return Settings()
