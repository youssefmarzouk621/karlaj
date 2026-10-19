#!/bin/sh
# Container entrypoint: apply database migrations (when enabled and available),
# then hand over to the server (CMD).
#
#   RUN_MIGRATIONS=true    run migrations on start (only one service should;
#                          the dashboard does by default)
#   DB_PUSH_ON_START=true  no migrations/ folder yet → sync the schema with
#                          `prisma db push` (refuses changes that lose data)
set -e

SCHEMA=/app/database/prisma/schema.prisma
MIGRATIONS=/app/database/prisma/migrations

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  if [ -d "$MIGRATIONS" ] && [ -n "$(ls -A "$MIGRATIONS" 2>/dev/null)" ]; then
    echo "[entrypoint] applying migrations"
    prisma migrate deploy --schema "$SCHEMA"
  elif [ "${DB_PUSH_ON_START:-false}" = "true" ]; then
    echo "[entrypoint] no migrations found — syncing schema with db push"
    prisma db push --schema "$SCHEMA" --skip-generate
  else
    echo "[entrypoint] no migrations found — skipping"
  fi
fi

exec "$@"
