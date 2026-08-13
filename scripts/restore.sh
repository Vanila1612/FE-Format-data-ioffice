#!/usr/bin/env sh
set -eu

SOURCE="${1:?Usage: scripts/restore.sh backup/YYYY-MM-DD-HHMMSS}"
DB_SERVICE="${DB_SERVICE:-postgres}"
DB_NAME="${POSTGRES_DB:-ioffice}"
DB_USER="${POSTGRES_USER:-ioffice}"
STORAGE_VOLUME="${STORAGE_VOLUME:-ioffice-web-application_app_storage}"

test -f "${SOURCE}/database.sql"
test -f "${SOURCE}/storage.tar.gz"

docker compose exec -T "${DB_SERVICE}" psql -U "${DB_USER}" "${DB_NAME}" < "${SOURCE}/database.sql"
docker run --rm -v "${STORAGE_VOLUME}:/storage" -v "$(pwd)/${SOURCE}:/backup:ro" alpine sh -c "rm -rf /storage/* && tar -xzf /backup/storage.tar.gz -C /storage"

echo "Restore completed from ${SOURCE}"
