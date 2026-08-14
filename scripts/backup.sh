#!/usr/bin/env sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-backup}"
STAMP="${1:-$(date +%Y-%m-%d-%H%M%S)}"
TARGET="${BACKUP_ROOT}/${STAMP}"
DB_SERVICE="${DB_SERVICE:-mongo}"
DB_NAME="${MONGO_INITDB_DATABASE:-ioffice}"
DB_USER="${MONGO_INITDB_ROOT_USERNAME:-ioffice}"
DB_PASSWORD="${MONGO_INITDB_ROOT_PASSWORD:-ioffice}"
STORAGE_VOLUME="${STORAGE_VOLUME:-ioffice-web-application_app_storage}"

mkdir -p "${TARGET}"

docker compose exec -T "${DB_SERVICE}" mongodump --username "${DB_USER}" --password "${DB_PASSWORD}" --authenticationDatabase admin --db "${DB_NAME}" --archive > "${TARGET}/database.archive"
docker run --rm -v "${STORAGE_VOLUME}:/storage:ro" -v "$(pwd)/${TARGET}:/backup" alpine sh -c "cd /storage && tar -czf /backup/storage.tar.gz ."

echo "Backup created at ${TARGET}"
