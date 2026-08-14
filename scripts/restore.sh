#!/usr/bin/env sh
set -eu

SOURCE="${1:?Usage: scripts/restore.sh backup/YYYY-MM-DD-HHMMSS}"
DB_SERVICE="${DB_SERVICE:-mongo}"
DB_NAME="${MONGO_INITDB_DATABASE:-ioffice}"
DB_USER="${MONGO_INITDB_ROOT_USERNAME:-ioffice}"
DB_PASSWORD="${MONGO_INITDB_ROOT_PASSWORD:-ioffice}"
STORAGE_VOLUME="${STORAGE_VOLUME:-ioffice-web-application_app_storage}"

test -f "${SOURCE}/database.archive"
test -f "${SOURCE}/storage.tar.gz"

docker compose exec -T "${DB_SERVICE}" mongorestore --username "${DB_USER}" --password "${DB_PASSWORD}" --authenticationDatabase admin --db "${DB_NAME}" --drop --archive < "${SOURCE}/database.archive"
docker run --rm -v "${STORAGE_VOLUME}:/storage" -v "$(pwd)/${SOURCE}:/backup:ro" alpine sh -c "rm -rf /storage/* && tar -xzf /backup/storage.tar.gz -C /storage"

echo "Restore completed from ${SOURCE}"
