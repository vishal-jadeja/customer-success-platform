"""Application error hierarchy. Every AppError maps 1:1 to the JSON envelope."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    code: str = "APP_ERROR"
    status: int = 500

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status: int | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status is not None:
            self.status = status
        self.details = details


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status = 404


class PermissionDeniedError(AppError):
    code = "PERMISSION_DENIED"
    status = 403


class ValidationError(AppError):
    code = "VALIDATION_ERROR"
    status = 422


class ConflictError(AppError):
    code = "CONFLICT"
    status = 409


class AuthError(AppError):
    """401. ``code`` may be overridden (e.g. ``REFRESH_RACE``)."""

    code = "UNAUTHORIZED"
    status = 401


class ExternalServiceError(AppError):
    code = "EXTERNAL_SERVICE_ERROR"
    status = 502
