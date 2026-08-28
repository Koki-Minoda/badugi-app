#!/usr/bin/env bash
set -euo pipefail

script="scripts/deploy/mgx-prod-01.sh"
bash -n "$script"

restart_line="$(grep -n 'systemctl restart mgx-backend.service' "$script" | cut -d: -f1)"
backend_health_line="$(grep -n '^verify_backend_after_restart$' "$script" | cut -d: -f1)"
sync_line="$(grep -n 'syncing frontend dist' "$script" | cut -d: -f1)"
test -n "$restart_line"
test -n "$backend_health_line"
test -n "$sync_line"
test "$restart_line" -lt "$backend_health_line"
test "$backend_health_line" -lt "$sync_line"
if grep -q 'source .*BACKEND_ENV_FILE' "$script"; then
  echo "backend environment file must not be evaluated as shell code" >&2
  exit 1
fi
grep -q 'verify_live_frontend' "$script"
grep -q 'verify_live_p2p_rest_route' "$script"
grep -q 'friend-match deep link did not return the current SPA asset' "$script"
grep -q 'npm run test:build:onnx' "$script"
grep -q 'configure_nginx_wasm_mime' "$script"
grep -q 'verify_live_onnx_wasm' "$script"
grep -q 'application/wasm wasm;' infra/nginx/mgx-wasm-types.conf
grep -q 'rolling back' "$script"
grep -q 'sudo -n rsync' "$script"
grep -q 'browser ArrayBuffer fallback remains supported' "$script"
grep -q 'application/octet-stream' "$script"
grep -q 'live browser QA must confirm' "$script"

echo "deploy static safety: PASS"
