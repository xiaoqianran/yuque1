#!/usr/bin/env bash
# Apply Prisma migrations from a one-shot container on the Compose network.
# Use when the host process cannot reach published localhost:5432 (DinD / nested net).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/deploy/compose/docker-compose.yml"
NAME="yuque1-migrate-$$"
NET="$(docker inspect yuque1-postgres -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)"

if [[ -z "$NET" ]]; then
  echo "[db-migrate-docker] starting compose postgres..."
  docker compose -f "$COMPOSE_FILE" up -d postgres
  for i in $(seq 1 30); do
    st="$(docker inspect -f '{{.State.Health.Status}}' yuque1-postgres 2>/dev/null || echo starting)"
    [[ "$st" == "healthy" ]] && break
    sleep 1
  done
  NET="$(docker inspect yuque1-postgres -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
fi

echo "[db-migrate-docker] network=$NET"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker create --name "$NAME" --network "$NET" \
  -e DATABASE_URL="postgresql://yuque:localdevonly@postgres:5432/yuque1?schema=public" \
  -w /app \
  node:22-bookworm sleep 600 >/dev/null

# docker cp streams files via API (works when bind mounts of /workspace are invisible to daemon)
docker cp "$ROOT/apps/api/prisma/." "$NAME:/app/prisma/"
docker start "$NAME" >/dev/null

docker exec "$NAME" bash -lc '
  set -euo pipefail
  npm install -g prisma@6.19.3 >/dev/null
  prisma migrate deploy --schema=/app/prisma/schema.prisma
'

docker rm -f "$NAME" >/dev/null
echo "[db-migrate-docker] done"
