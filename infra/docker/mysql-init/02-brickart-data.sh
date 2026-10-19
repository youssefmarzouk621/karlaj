#!/bin/bash
# Runs once, on the first start of an empty MySQL volume (docker-entrypoint-initdb.d).
# Loads the snapshot of the local dev database made by infra/scripts/export-local-data.sh
# into MYSQL_DATABASE, pointing stored image URLs at this deployment.
set -euo pipefail

DUMP=/docker-entrypoint-initdb.d/data/brickart.sql.gz

if [ ! -f "$DUMP" ]; then
  echo "[02-brickart-data] no $DUMP — starting with an empty database"
  exit 0
fi

: "${ASSETS_BASE_URL:?ASSETS_BASE_URL is required}"

echo "[02-brickart-data] importing $DUMP into ${MYSQL_DATABASE} (assets at ${ASSETS_BASE_URL})"
gzip -dc "$DUMP" \
  | sed "s#__ASSETS_BASE_URL__#${ASSETS_BASE_URL}#g" \
  | mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}"
