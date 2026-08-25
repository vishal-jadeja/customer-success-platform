"""slowapi limiter keyed on the real client behind the Vercel -> Render proxy."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

LOGIN_LIMIT = "10/minute"


def client_ip(request: Request) -> str:
    """First hop of X-Forwarded-For (the browser), else the socket address.

    Behind the proxy every user shares one socket IP; keying on it would
    throttle everyone together.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, enabled=get_settings().RATE_LIMIT_ENABLED)
