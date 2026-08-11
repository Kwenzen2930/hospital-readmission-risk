#!/bin/zsh

cd "$(dirname "$0")"

echo "Starting FastAPI backend..."
conda run -n readmission python -m uvicorn backend.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload &
BACKEND_PID=$!

echo "Starting Next.js frontend..."
npm --prefix frontend run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Stopping Hospital Readmission Risk..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit
}

trap cleanup INT TERM EXIT

echo "Waiting for dashboard..."

for attempt in $(seq 1 30); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    echo "Dashboard ready"
    open http://localhost:3000
    break
  fi
  sleep 1
done

wait
