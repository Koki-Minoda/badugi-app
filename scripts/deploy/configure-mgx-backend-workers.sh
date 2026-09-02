#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/badugi-app}"
SERVICE_NAME="${MGX_BACKEND_SERVICE:-mgx-backend.service}"
TARGET_WORKERS="${MGX_BACKEND_WORKERS:-2}"
HEALTH_URL="${MGX_BACKEND_LOCAL_HEALTH_URL:-http://127.0.0.1:8000/api/health}"
OVERRIDE_DIR="/etc/systemd/system/${SERVICE_NAME}.d"
OVERRIDE_FILE="${OVERRIDE_DIR}/20-mgx-workers.conf"
BACKUP_DIR="/var/backups/mgx-systemd"

fail() {
  echo "[mgx-workers] ERROR: $*" >&2
  exit 1
}

case "$TARGET_WORKERS" in
  2|3|4) ;;
  *) fail "MGX_BACKEND_WORKERS must be 2, 3, or 4" ;;
esac
test "$APP_DIR" != "/" || fail "APP_DIR cannot be /"
UVICORN="${APP_DIR}/backend/.venv/bin/uvicorn"
test -x "$UVICORN" || fail "uvicorn is not executable: $UVICORN"

temporary_dir="$(mktemp -d)"
candidate="${temporary_dir}/20-mgx-workers.conf"
previous="${temporary_dir}/previous.conf"
had_previous=0
cleanup() { rm -rf -- "$temporary_dir"; }
trap cleanup EXIT

printf '%s\n' \
  '[Service]' \
  'ExecStart=' \
  "ExecStart=${UVICORN} app.main:app --host 127.0.0.1 --port 8000 --workers ${TARGET_WORKERS} --log-level \${MGX_LOG_LEVEL}" \
  >"$candidate"

if sudo -n test -f "$OVERRIDE_FILE"; then
  sudo -n cp "$OVERRIDE_FILE" "$previous"
  had_previous=1
fi
sudo -n install -d -m 0755 "$OVERRIDE_DIR" "$BACKUP_DIR"
if ((had_previous)); then
  sudo -n cp "$OVERRIDE_FILE" "${BACKUP_DIR}/20-mgx-workers.$(date -u +%Y%m%dT%H%M%SZ).conf"
fi

restore_previous() {
  echo "[mgx-workers] rolling back worker override" >&2
  if ((had_previous)); then
    sudo -n install -m 0644 "$previous" "$OVERRIDE_FILE"
  else
    sudo -n rm -f "$OVERRIDE_FILE"
  fi
  sudo -n systemctl daemon-reload
  sudo -n systemctl restart "$SERVICE_NAME"
}

install_override() {
  local workers="$1"
  sed "s/--workers ${TARGET_WORKERS}/--workers ${workers}/" "$candidate" >"${temporary_dir}/active.conf"
  sudo -n install -m 0644 "${temporary_dir}/active.conf" "$OVERRIDE_FILE"
  sudo -n systemctl daemon-reload
}

wait_for_health() {
  local attempt
  for ((attempt = 1; attempt <= 20; attempt++)); do
    if curl -fsS "$HEALTH_URL" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# A one-worker restart applies and verifies migrations without concurrent
# startup migration runners. Only then is the service moved to two workers.
install_override 1
if ! sudo -n systemctl restart "$SERVICE_NAME" || ! wait_for_health; then
  restore_previous
  fail "single-worker migration preflight failed"
fi

install_override "$TARGET_WORKERS"
if ! sudo -n systemctl restart "$SERVICE_NAME" || ! wait_for_health; then
  restore_previous
  fail "multi-worker startup failed"
fi

exec_start="$(sudo -n systemctl show --property=ExecStart --value "$SERVICE_NAME")"
if ! grep -q -- "--workers ${TARGET_WORKERS}" <<<"$exec_start"; then
  restore_previous
  fail "active service does not report --workers ${TARGET_WORKERS}"
fi
echo "[mgx-workers] ${SERVICE_NAME} healthy with ${TARGET_WORKERS} workers"
