#!/bin/sh
# set -e: a failed migration must crash the container loudly instead of
# serving against a half-migrated DB.
set -e

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
