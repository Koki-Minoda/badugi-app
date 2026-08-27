#!/usr/bin/env bash
# Safely add the Friend Match WebSocket proxy to the active MGX nginx site.
set -euo pipefail

readonly DEFAULT_SITE_PATH="/etc/nginx/sites-enabled/mgx-poker.com"
readonly DEFAULT_BACKUP_DIR="/var/backups/mgx-nginx"
readonly BEGIN_MARKER="# BEGIN MGX MANAGED P2P WEBSOCKET"
readonly END_MARKER="# END MGX MANAGED P2P WEBSOCKET"

fail() {
  echo "[mgx-nginx-ws] ERROR: $*" >&2
  exit 1
}

if [ "${MGX_NGINX_TEST_MODE:-0}" = "1" ]; then
  SITE_PATH="${MGX_NGINX_SITE_PATH:-$DEFAULT_SITE_PATH}"
  BACKUP_DIR="${MGX_NGINX_BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"
  SUDO_BIN="${MGX_NGINX_SUDO_BIN:-sudo}"
  NGINX_BIN="${MGX_NGINX_BIN:-/usr/sbin/nginx}"
else
  SITE_PATH="$DEFAULT_SITE_PATH"
  BACKUP_DIR="$DEFAULT_BACKUP_DIR"
  SUDO_BIN="sudo"
  NGINX_BIN="/usr/sbin/nginx"
  if [ -n "${MGX_NGINX_SITE_PATH:-}" ] || [ -n "${MGX_NGINX_BACKUP_DIR:-}" ] || [ -n "${MGX_NGINX_SUDO_BIN:-}" ] || [ -n "${MGX_NGINX_BIN:-}" ]; then
    fail "path and command overrides are allowed only in test mode"
  fi
fi

run_sudo() {
  "$SUDO_BIN" -n "$@"
}

count_exact_lines() {
  local pattern="$1"
  local input_file="$2"
  awk -v pattern="$pattern" '$0 ~ pattern { count++ } END { print count + 0 }' "$input_file"
}

snapshot="$(mktemp "${TMPDIR:-/tmp}/mgx-nginx-ws.XXXXXX")"
candidate="$(mktemp "${TMPDIR:-/tmp}/mgx-nginx-ws-candidate.XXXXXX")"
cleanup() {
  rm -f -- "$snapshot" "$candidate"
}
trap cleanup EXIT

run_sudo true || fail "passwordless sudo is required (sudo -n)"
run_sudo test -f "$SITE_PATH" || fail "active nginx site not found: $SITE_PATH"
run_sudo cat -- "$SITE_PATH" >"$snapshot"

server_name_count="$(count_exact_lines "^[[:space:]]*server_name[[:space:]].*mgx-poker\\.com.*;[[:space:]]*$" "$snapshot")"
if [ "$server_name_count" -lt 1 ]; then
  fail "refusing to edit a site without an mgx-poker.com server_name"
fi

begin_count="$(grep -Ec "^[[:space:]]*${BEGIN_MARKER}$" "$snapshot" || true)"
end_count="$(grep -Ec "^[[:space:]]*${END_MARKER}$" "$snapshot" || true)"
ws_count="$(count_exact_lines "^[[:space:]]*location[[:space:]]+/ws/[[:space:]]*\\{[[:space:]]*$" "$snapshot")"
if [ "$begin_count" -ne 0 ] || [ "$end_count" -ne 0 ]; then
  if [ "$begin_count" -ne 1 ] || [ "$end_count" -ne 1 ] || [ "$ws_count" -ne 1 ]; then
    fail "managed marker validation failed (begin=$begin_count end=$end_count ws=$ws_count)"
  fi
  echo "[mgx-nginx-ws] managed /ws/ location already present; no changes required"
  exit 0
fi
if [ "$ws_count" -gt 0 ]; then
  echo "[mgx-nginx-ws] /ws/ location already present; no changes required"
  exit 0
fi

api_count="$(count_exact_lines "^[[:space:]]*location[[:space:]]+/api/[[:space:]]*\\{[[:space:]]*$" "$snapshot")"
health_count="$(count_exact_lines "^[[:space:]]*location[[:space:]]+/healthz[[:space:]]*\\{[[:space:]]*$" "$snapshot")"
upstream_count="$(count_exact_lines "^[[:space:]]*upstream[[:space:]]+mgx_backend[[:space:]]*\\{[[:space:]]*$" "$snapshot")"
if [ "$api_count" -ne 1 ] || [ "$health_count" -ne 1 ] || [ "$upstream_count" -ne 1 ]; then
  fail "expected one mgx_backend, /api/, and /healthz marker (upstream=$upstream_count api=$api_count health=$health_count)"
fi

awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  /^[[:space:]]*location[[:space:]]+\/healthz[[:space:]]*\{[[:space:]]*$/ {
    print "    " begin
    print "    location /ws/ {"
    print "        proxy_pass http://mgx_backend;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Upgrade           $http_upgrade;"
    print "        proxy_set_header Connection        \"upgrade\";"
    print "        proxy_set_header Host              $host;"
    print "        proxy_set_header X-Real-IP         $remote_addr;"
    print "        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "        proxy_read_timeout 75s;"
    print "    }"
    print "    " end
    print ""
  }
  { print }
' "$snapshot" >"$candidate"

candidate_ws_count="$(count_exact_lines "^[[:space:]]*location[[:space:]]+/ws/[[:space:]]*\\{[[:space:]]*$" "$candidate")"
candidate_begin_count="$(grep -Ec "^[[:space:]]*${BEGIN_MARKER}$" "$candidate" || true)"
candidate_end_count="$(grep -Ec "^[[:space:]]*${END_MARKER}$" "$candidate" || true)"
if [ "$candidate_ws_count" -ne 1 ] || [ "$candidate_begin_count" -ne 1 ] || [ "$candidate_end_count" -ne 1 ]; then
  fail "generated nginx candidate failed managed-block validation"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${BACKUP_DIR}/mgx-poker.com.${timestamp}.conf"
run_sudo install -d -m 0700 -- "$BACKUP_DIR"
run_sudo test ! -e "$backup_path" || fail "timestamp backup already exists: $backup_path"
run_sudo cp -p -- "$SITE_PATH" "$backup_path"
run_sudo cp -- "$candidate" "$SITE_PATH"

if ! run_sudo "$NGINX_BIN" -t; then
  echo "[mgx-nginx-ws] nginx validation failed; restoring $backup_path" >&2
  run_sudo cp -- "$backup_path" "$SITE_PATH"
  run_sudo "$NGINX_BIN" -t >/dev/null 2>&1 || true
  fail "candidate rejected by nginx; original site restored"
fi

echo "[mgx-nginx-ws] installed /ws/ proxy; backup: $backup_path"
