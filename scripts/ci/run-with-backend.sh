#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <command> [args ...]" >&2
  exit 2
fi

runtime_dir="${RUNNER_TEMP:-/tmp}"
db_path="${MGX_CI_DB_PATH:-${runtime_dir}/mgx-ci-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}.sqlite3}"
backend_port="${MGX_CI_BACKEND_PORT:-8000}"
backend_origin="http://127.0.0.1:${backend_port}"

if curl -fsS "${backend_origin}/api/health" >/dev/null 2>&1; then
  echo "refusing to reuse an existing service at ${backend_origin}" >&2
  exit 1
fi

(
  cd backend
  env \
    BACKEND_ENV=local \
    BACKEND_DB_DRIVER=sqlite \
    BACKEND_DB_NAME="$db_path" \
    SECRET_KEY=ci-only-secret-key-with-32-bytes-minimum \
    CORS_ORIGINS='["http://127.0.0.1:3000"]' \
    python -m uvicorn app.main:app --host 127.0.0.1 --port "$backend_port"
) &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT

for _ in {1..80}; do
  if kill -0 "$backend_pid" 2>/dev/null \
    && curl -fsS "${backend_origin}/api/health" >/dev/null; then
    "$@"
    exit 0
  fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "CI backend exited before becoming healthy" >&2
    exit 1
  fi
  sleep 0.25
done

echo "CI backend did not become healthy at ${backend_origin}" >&2
exit 1
