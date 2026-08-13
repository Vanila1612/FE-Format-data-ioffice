#!/usr/bin/env sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-backup}"
STAMP="${1:-$(date +%Y-%m-%d-%H%M%S)}"
TARGET="${BACKUP_ROOT}/${STAMP}"
DB_SERVICE="${DB_SERVICE:-postgres}"
DB_NAME="${POSTGRES_DB:-ioffice}"
DB_USER="${POSTGRES_USER:-ioffice}"
STORAGE_VOLUME="${STORAGE_VOLUME:-ioffice-web-application_app_storage}"

mkdir -p "${TARGET}"

docker compose exec -T "${DB_SERVICE}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${TARGET}/database.sql"
docker run --rm -v "${STORAGE_VOLUME}:/storage:ro" -v "$(pwd)/${TARGET}:/backup" alpine sh -c "cd /storage && tar -czf /backup/storage.tar.gz ."

echo "Backup created at ${TARGET}"
