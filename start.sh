#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/backend"
npm run dev &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

# wait until backend accepts connections
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:3001/api/health" >/dev/null; then
    break
  fi
  sleep 0.4
done

cd "$ROOT/frontend"
npm run dev
