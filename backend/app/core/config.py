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

from pydantic import field_validator, model_validator
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
    # Model defaults: llama-3.3-70b-versatile (Groq, shut down 08/16/26 for
    # free/dev tier) and llama-3.3-70b (Cerebras, shut down 2026-02-16) are
    # both decommissioned — confirmed live (404 model_not_found on both APIs,
    # 2026-08-25). openai/gpt-oss-120b is each provider's own recommended
    # replacement (same family, available on both). Verified live end-to-end
    # on Groq (real completion, insight status=completed); Cerebras's key
    # still needs billing set up on that account (402 payment_required) —
    # an account-console fix, not a code issue.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    CEREBRAS_API_KEY: str = ""
    CEREBRAS_MODEL: str = "gpt-oss-120b"
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

    @model_validator(mode="after")
    def _warn_empty_cors(self) -> Settings:
        # Model-level (not field-level) so ENV is populated regardless of field
        # order. In non-dev an empty origins list is almost certainly a
        # misconfig. Warn, do not raise — CORS is not load-bearing behind the proxy.
        if self.ENV != "dev" and not self.CORS_ORIGINS:
            logger.warning("CORS_ORIGINS is empty in ENV=%s; /docs may be unreachable", self.ENV)
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide cached Settings instance."""
    return Settings()
