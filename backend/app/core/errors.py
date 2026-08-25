"""Exception handlers -> the single JSON error envelope.

{"error": {"code", "message", "details", "request_id"}}
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError
from app.core.logging import get_logger, request_id_var

logger = get_logger(__name__)

_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


def envelope(
    status: int,
    code: str,
    message: str,
    details: Any = None,
    *,
    request_id: str | None = None,
) -> JSONResponse:
    body = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id or request_id_var.get(),
        }
    }
    return JSONResponse(status_code=status, content=body)


def _clean_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # ``ctx``/``input`` may hold non-JSON-able objects (exceptions, bytes).
    return [{k: v for k, v in e.items() if k in ("loc", "msg", "type")} for e in errors]


def _constraint_name(exc: IntegrityError) -> str | None:
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None) if diag is not None else None


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return envelope(exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return envelope(
            422,
            "VALIDATION_ERROR",
            "Request validation failed",
            _clean_validation_errors(exc.errors()),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        return envelope(exc.status_code, code, message)

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        # Unique violations (email) and ON DELETE RESTRICT both land here: 409, never 500.
        name = _constraint_name(exc)
        logger.info("integrity error mapped to 409 (constraint=%s)", name)
        return envelope(
            409, "CONFLICT", "Resource conflict", {"constraint": name} if name else None
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return envelope(429, "RATE_LIMITED", f"Rate limit exceeded: {exc.detail}")

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Starlette runs this handler in ServerErrorMiddleware, OUTSIDE
        # RequestIDMiddleware: the contextvar is already reset and the response
        # header hook is gone. Recover the id from request.state (stashed by
        # the middleware) so the log line, body and header still carry it.
        request_id = getattr(request.state, "request_id", None) or request_id_var.get()
        token = request_id_var.set(request_id)
        try:
            logger.exception("unhandled error: %s", exc)
        finally:
            request_id_var.reset(token)
        response = envelope(500, "INTERNAL_ERROR", "Internal server error", request_id=request_id)
        response.headers["X-Request-ID"] = request_id
        return response
