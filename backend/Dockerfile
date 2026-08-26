# python:3.13-slim matches .python-version. psycopg2-binary (not psycopg2)
# is pinned in pyproject.toml specifically so no libpq-dev/build-essential is
# needed here — switching to the non-binary driver would require adding them.
FROM python:3.13-slim

WORKDIR /app

# No build tools needed: psycopg2-binary bundles libpq, and every other
# dependency is pure-Python or ships wheels.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

COPY alembic.ini ./
COPY scripts ./scripts
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Non-root: create after install so pip's cache/build artifacts aren't owned
# by an unprivileged user mid-build, then hand the final tree to it.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
