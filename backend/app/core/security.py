"""Password hashing via ``bcrypt`` directly (no passlib — unmaintained, breaks
on bcrypt>=4.1 and Python 3.13).

JWT encode/decode and refresh-token helpers are added in Phase 03.
bcrypt only considers the first 72 bytes; the 8–72 char cap is enforced in the
request schemas.
"""

from __future__ import annotations

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Malformed stored hash — treat as a failed check, never a 500.
        return False
