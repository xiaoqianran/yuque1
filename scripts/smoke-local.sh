#!/usr/bin/env bash
# End-to-end local smoke for M0 (works in host-network OR docker-isolated workspaces).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1) unit/typecheck/build (host)"
pnpm run check:node
pnpm run check:docs
pnpm run prisma:generate
pnpm run typecheck
pnpm run test
pnpm run build

echo "==> 2) compose up"
pnpm compose:up
for i in $(seq 1 30); do
  st="$(docker inspect -f '{{.State.Health.Status}}' yuque1-postgres 2>/dev/null || echo starting)"
  [[ "$st" == "healthy" ]] && break
  sleep 1
done

echo "==> 3) migrate"
if node -e "const n=require('net');const s=n.connect(5432,'127.0.0.1',()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),800);"; then
  echo "    host can reach :5432 → pnpm db:migrate"
  pnpm db:migrate
else
  echo "    host cannot reach :5432 → scripts/db-migrate-docker.sh"
  bash "$ROOT/scripts/db-migrate-docker.sh"
fi

echo "==> 4) API smoke"
if node -e "const n=require('net');const s=n.connect(5432,'127.0.0.1',()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),800);"; then
  API_PORT=3020 node apps/api/dist/main.js > /tmp/yuque1-api-smoke.log 2>&1 &
  PID=$!
  sleep 2
  HEALTH="$(curl -sS http://127.0.0.1:3020/api/v1/health)"
  READY="$(curl -sS http://127.0.0.1:3020/api/v1/ready)"
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
else
  NET="$(docker inspect yuque1-postgres -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
  NAME="yuque1-api-smoke-$$"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker create --name "$NAME" --network "$NET" \
    -e DATABASE_URL="postgresql://yuque:localdevonly@postgres:5432/yuque1?schema=public" \
    -e REDIS_URL="redis://redis:6379" \
    -e API_PORT=3000 \
    -w /workspace/1/yuque1 \
    node:22-bookworm sleep 120 >/dev/null
  docker cp "$ROOT/." "$NAME:/workspace/1/yuque1/" >/dev/null
  docker start "$NAME" >/dev/null
  docker exec -d "$NAME" bash -lc 'cd /workspace/1/yuque1 && node apps/api/dist/main.js > /tmp/api.log 2>&1'
  sleep 3
  HEALTH="$(docker exec "$NAME" curl -sS http://127.0.0.1:3000/api/v1/health)"
  READY="$(docker exec "$NAME" curl -sS http://127.0.0.1:3000/api/v1/ready)"
  docker rm -f "$NAME" >/dev/null
fi

echo "    health=$HEALTH"
echo "    ready=$READY"
echo "$HEALTH" | grep -q '"success":true'
echo "$READY" | grep -q '"success":true'
echo "$READY" | grep -q '"postgres":true'

echo "==> ALL SMOKE CHECKS PASSED"
