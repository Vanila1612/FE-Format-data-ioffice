#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BRANCH="${BRANCH:-}"
HEALTH_URL="${HEALTH_URL:-http://localhost:5173/api/health}"

cd "$(dirname "$0")/.."

echo "==> Updating source code"
if [ -n "${BRANCH}" ]; then
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
else
  git pull --ff-only
fi

if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod is missing."
  echo "Create it first:"
  echo "  cp .env.prod.example .env.prod"
  echo "  nano .env.prod"
  exit 1
fi

echo "==> Building Docker images"
docker compose -f "${COMPOSE_FILE}" build

echo "==> Starting services"
docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Current status"
docker compose -f "${COMPOSE_FILE}" ps

echo "==> Waiting for frontend/backend health"
attempt=1
while [ "${attempt}" -le 30 ]; do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "OK: ${HEALTH_URL}"
    echo "==> Recent backend logs"
    docker compose -f "${COMPOSE_FILE}" logs --tail=40 backend
    exit 0
  fi
  echo "Waiting... (${attempt}/30)"
  attempt=$((attempt + 1))
  sleep 3
done

echo "ERROR: Health check failed: ${HEALTH_URL}"
echo "==> Backend logs"
docker compose -f "${COMPOSE_FILE}" logs --tail=120 backend
echo "==> Frontend logs"
docker compose -f "${COMPOSE_FILE}" logs --tail=120 frontend
exit 1
