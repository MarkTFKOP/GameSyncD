#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "env.sh" ]]; then
  echo "Missing env.sh. Copy env.example to env.sh and fill values."
  exit 1
fi

source "./env.sh"

mkdir -p "${OUTPUT_DIR:-data}"

echo "Running initial sync..."
node backend/sync_games_node.mjs

if [[ ! -d "frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm --prefix frontend install
fi

echo "Starting backend at http://localhost:${BACKEND_PORT:-8787}"
node backend/server.mjs &
BACKEND_PID=$!

cleanup() {
  if ps -p "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting frontend at http://localhost:${FRONTEND_PORT:-5173}"
VITE_API_BASE="${VITE_API_BASE:-http://localhost:${BACKEND_PORT:-8787}}" \
  npm --prefix frontend run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT:-5173}"
