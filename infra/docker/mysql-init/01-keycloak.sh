#!/bin/bash
# Runs once, on the first start of an empty MySQL volume (docker-entrypoint-initdb.d).
# Gives Keycloak its own database + user next to the app's `brickart` database.
set -euo pipefail

: "${KEYCLOAK_DB_NAME:=keycloak}"
: "${KEYCLOAK_DB_USER:=keycloak}"
: "${KEYCLOAK_DB_PASSWORD:?KEYCLOAK_DB_PASSWORD is required}"

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${KEYCLOAK_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${KEYCLOAK_DB_USER}'@'%' IDENTIFIED BY '${KEYCLOAK_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${KEYCLOAK_DB_NAME}\`.* TO '${KEYCLOAK_DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
