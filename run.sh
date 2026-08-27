#!/usr/bin/env bash
# Starts both FOODFLOW servers (backend on :8000, frontend on :5173).
# Press Ctrl+C to stop both.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$DIR/backend"
FRONTEND="$DIR/frontend"

# Free up the ports in case a previous run was left dangling.
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill 2>/dev/null || true
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null || true

# Kill both child processes when this script exits (Ctrl+C included).
cleanup() {
  echo ""
  echo "Stopping FOODFLOW..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:8000 ..."
(cd "$BACKEND" && ./venv/bin/uvicorn main:app --port 8000 --reload) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173 ..."
(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "FOODFLOW is starting up:"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

wait "$BACKEND_PID" "$FRONTEND_PID"
