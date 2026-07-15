#!/usr/bin/env bash
# Business E2E API smoke: login → kb → doc → content → share.
# Works on host network OR DinD (same strategy as smoke-local.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export SMS_PROVIDER="${SMS_PROVIDER:-mock}"
export SMS_MOCK_CODE="${SMS_MOCK_CODE:-123456}"
export SESSION_SECRET="${SESSION_SECRET:-local-e2e-session-secret-at-least-32-chars}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173}"

echo "==> 0) build api (if needed)"
if [[ ! -f apps/api/dist/main.js ]]; then
  pnpm --filter @yuque1/api build
else
  # ensure dist is not stale for CI/local after code change
  pnpm --filter @yuque1/api build
fi

echo "==> 1) compose up + migrate"
pnpm compose:up
for i in $(seq 1 30); do
  st="$(docker inspect -f '{{.State.Health.Status}}' yuque1-postgres 2>/dev/null || echo starting)"
  [[ "$st" == "healthy" ]] && break
  sleep 1
done

if node -e "const n=require('net');const s=n.connect(5432,'127.0.0.1',()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),800);"; then
  pnpm db:migrate
  HOST_DB=1
else
  bash "$ROOT/scripts/db-migrate-docker.sh"
  HOST_DB=0
fi

run_e2e_host() {
  local port="${1:-3030}"
  echo "==> 2) start API on :${port} (host)"
  API_PORT="$port" \
    DATABASE_URL="${DATABASE_URL:-postgresql://yuque:localdevonly@127.0.0.1:5432/yuque1?schema=public}" \
    REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}" \
    SMS_PROVIDER=mock SMS_MOCK_CODE="$SMS_MOCK_CODE" \
    node apps/api/dist/main.js > /tmp/yuque1-e2e-api.log 2>&1 &
  local pid=$!
  cleanup() { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
  trap cleanup EXIT
  for i in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${port}/api/v1/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
  echo "==> 3) business flow"
  node "$ROOT/scripts/smoke-e2e-api.mjs" "http://127.0.0.1:${port}"
  cleanup
  trap - EXIT
}

run_e2e_docker() {
  echo "==> 2) start API in compose network (DinD)"
  local net name
  net="$(docker inspect yuque1-postgres -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
  name="yuque1-e2e-api-$$"
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker create --name "$name" --network "$net" \
    -e DATABASE_URL="postgresql://yuque:localdevonly@postgres:5432/yuque1?schema=public" \
    -e REDIS_URL="redis://redis:6379" \
    -e API_PORT=3000 \
    -e SMS_PROVIDER=mock \
    -e SMS_MOCK_CODE="$SMS_MOCK_CODE" \
    -e SESSION_SECRET="$SESSION_SECRET" \
    -e COOKIE_SECURE=false \
    -e CORS_ORIGIN=http://localhost:5173 \
    -w /workspace/1/yuque1 \
    node:22-bookworm sleep 180 >/dev/null
  docker cp "$ROOT/." "$name:/workspace/1/yuque1/" >/dev/null
  docker start "$name" >/dev/null
  docker exec -d "$name" bash -lc 'cd /workspace/1/yuque1 && node apps/api/dist/main.js > /tmp/api.log 2>&1'
  for i in $(seq 1 40); do
    if docker exec "$name" curl -sf http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
  echo "==> 3) business flow (inside container)"
  docker cp "$ROOT/scripts/smoke-e2e-api.mjs" "$name:/workspace/1/yuque1/scripts/smoke-e2e-api.mjs" >/dev/null
  docker exec "$name" bash -lc "cd /workspace/1/yuque1 && SMS_MOCK_CODE=$SMS_MOCK_CODE node scripts/smoke-e2e-api.mjs http://127.0.0.1:3000"
  docker rm -f "$name" >/dev/null
}

if [[ "$HOST_DB" == "1" ]]; then
  run_e2e_host 3030
else
  run_e2e_docker
fi

echo "==> ALL E2E SMOKE CHECKS PASSED"
