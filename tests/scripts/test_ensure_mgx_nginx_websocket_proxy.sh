#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/deploy/ensure_mgx_nginx_websocket_proxy.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mgx-nginx-ws-test.XXXXXX")"
SITE="$TEST_DIR/mgx-poker.com"
BACKUP_DIR="$TEST_DIR/backups"
MOCK_SUDO="$TEST_DIR/sudo"
NGINX_RESULT="$TEST_DIR/nginx-result"

cleanup() {
  rm -rf -- "$TEST_DIR"
}
trap cleanup EXIT

fail() {
  echo "test failure: $*" >&2
  exit 1
}

write_base_site() {
  cat >"$SITE" <<'CONFIG'
upstream mgx_backend {
    server 127.0.0.1:8000;
}
server {
    listen 443 ssl;
    server_name mgx-poker.com;
    location /api/ {
        proxy_pass http://mgx_backend;
    }
    location /healthz {
        proxy_pass http://mgx_backend/api/health;
    }
}
CONFIG
}

cat >"$MOCK_SUDO" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
test "$1" = "-n"
shift
if [ "$1" = "mock-nginx" ]; then
  if [ "$2" = "-T" ]; then
    test -n "${MGX_TEST_DISCOVERY_SITE:-}"
    printf '# configuration file %s:\n' "$MGX_TEST_DISCOVERY_SITE"
    cat "$MGX_TEST_DISCOVERY_SITE"
    exit 0
  fi
  test "$2" = "-t"
  result="$(cat "$MGX_TEST_NGINX_RESULT")"
  if [ "$result" = "fail-once" ]; then
    printf '%s\n' pass >"$MGX_TEST_NGINX_RESULT"
    exit 1
  fi
  test "$result" = "pass"
  exit 0
fi
exec "$@"
MOCK
chmod +x "$MOCK_SUDO"

run_script() {
  MGX_NGINX_TEST_MODE=1 \
    MGX_NGINX_SITE_PATH="${SITE_OVERRIDE:-$SITE}" \
    MGX_NGINX_BACKUP_DIR="$BACKUP_DIR" \
    MGX_NGINX_SUDO_BIN="$MOCK_SUDO" \
    MGX_NGINX_BIN="mock-nginx" \
    MGX_TEST_NGINX_RESULT="$NGINX_RESULT" \
    MGX_TEST_DISCOVERY_SITE="${DISCOVERY_SITE:-}" \
    "$SCRIPT"
}

bash -n "$SCRIPT"
bash -n "$ROOT_DIR/scripts/deploy/mgx-prod-01.sh"
ensure_line="$(grep -n 'ensure_mgx_nginx_websocket_proxy.sh' "$ROOT_DIR/scripts/deploy/mgx-prod-01.sh" | cut -d: -f1)"
nginx_test_line="$(grep -n 'sudo -n /usr/sbin/nginx -t' "$ROOT_DIR/scripts/deploy/mgx-prod-01.sh" | cut -d: -f1)"
reload_line="$(grep -n 'sudo -n /usr/bin/systemctl reload nginx' "$ROOT_DIR/scripts/deploy/mgx-prod-01.sh" | cut -d: -f1)"
test "$ensure_line" -lt "$nginx_test_line" || fail "ensure script must run before the final nginx test"
test "$nginx_test_line" -lt "$reload_line" || fail "nginx must be tested before reload"

printf '%s\n' pass >"$NGINX_RESULT"
write_base_site
run_script
test "$(grep -c 'location /ws/ {' "$SITE")" -eq 1 || fail "expected one WebSocket location"
test "$(grep -c 'BEGIN MGX MANAGED P2P WEBSOCKET' "$SITE")" -eq 1 || fail "missing begin marker"
backup_count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mgx-poker.com.*.conf' | wc -l | tr -d ' ')"
test "$backup_count" -eq 1 || fail "expected one timestamp backup"

rm -f -- "$BACKUP_DIR"/mgx-poker.com.*.conf
write_base_site
DISCOVERY_SITE="$TEST_DIR/custom-live-site.conf"
mv -- "$SITE" "$DISCOVERY_SITE"
SITE_OVERRIDE="$TEST_DIR/missing-site.conf"
run_script
test "$(grep -c 'location /ws/ {' "$DISCOVERY_SITE")" -eq 1 || fail "discovered site was not updated"
unset DISCOVERY_SITE SITE_OVERRIDE
cp -- "$TEST_DIR/custom-live-site.conf" "$SITE"

before_noop="$(cksum "$SITE")"
run_script
after_noop="$(cksum "$SITE")"
test "$before_noop" = "$after_noop" || fail "idempotent run modified the active site"
backup_count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mgx-poker.com.*.conf' | wc -l | tr -d ' ')"
test "$backup_count" -eq 1 || fail "no-op run created another backup"

rm -f -- "$BACKUP_DIR"/mgx-poker.com.*.conf
write_base_site
awk '
  /^[[:space:]]*location[[:space:]]+\/healthz/ {
    print "    location /ws/ {"
    print "        proxy_pass http://mgx_backend;"
    print "    }"
  }
  { print }
' "$SITE" >"$SITE.unmanaged"
mv -- "$SITE.unmanaged" "$SITE"
unmanaged_before="$(cksum "$SITE")"
run_script
test "$unmanaged_before" = "$(cksum "$SITE")" || fail "existing unmanaged /ws/ block was modified"
test ! -d "$BACKUP_DIR" || test -z "$(find "$BACKUP_DIR" -type f -print -quit)" || fail "unmanaged no-op created a backup"

write_base_site
original="$(cksum "$SITE")"
printf '%s\n' fail-once >"$NGINX_RESULT"
if run_script; then
  fail "nginx validation failure should fail the script"
fi
test "$original" = "$(cksum "$SITE")" || fail "nginx failure did not restore original site"

rm -f -- "$BACKUP_DIR"/mgx-poker.com.*.conf
write_base_site
awk '
  /^[[:space:]]*location[[:space:]]+\/healthz/ {
    print "    # BEGIN MGX MANAGED P2P WEBSOCKET"
  }
  { print }
' "$SITE" >"$SITE.partial"
mv -- "$SITE.partial" "$SITE"
printf '%s\n' pass >"$NGINX_RESULT"
if run_script; then
  fail "partial managed marker should be rejected"
fi

echo "ensure_mgx_nginx_websocket_proxy tests passed"
