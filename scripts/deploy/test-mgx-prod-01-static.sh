#!/usr/bin/env bash
set -euo pipefail

script="scripts/deploy/mgx-prod-01.sh"
bash -n "$script"
bash -n scripts/ci/run-with-backend.sh
bash -n scripts/deploy/backup_mgx_prod_01.sh
bash -n scripts/deploy/rollback_mgx_prod_01.sh
bash -n scripts/deploy/configure-mgx-backend-workers.sh

restart_line="$(grep -n 'configure-mgx-backend-workers.sh' "$script" | cut -d: -f1)"
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
grep -q 'remove_stale_nested_frontend_assets' "$script"
grep -q 'DEPLOY_TARGET}/dev/assets' "$script"
grep -q 'verify_live_p2p_rest_route' "$script"
grep -q -- '--max-time 5' "$script"
grep -q 'Sec-WebSocket-Key: MDEyMzQ1Njc4OWFiY2RlZg==' "$script"
grep -q 'expected protocol upgrade 101' "$script"
if grep -q 'bWd4LXByb2Qtd3Mtc21va2U=' "$script"; then
  echo "deploy WebSocket smoke must not use the invalid 17-byte legacy key" >&2
  exit 1
fi
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
grep -q 'install_override 1' scripts/deploy/configure-mgx-backend-workers.sh
grep -q "install_override \"\$TARGET_WORKERS\"" scripts/deploy/configure-mgx-backend-workers.sh
grep -q 'rolling back worker override' scripts/deploy/configure-mgx-backend-workers.sh
grep -q -- '--workers 2' infra/systemd/mgx-backend.service.example
grep -q 'NoNewPrivileges=true' infra/systemd/mgx-backend.service.example
grep -q 'ProtectSystem=strict' infra/systemd/mgx-backend.service.example
grep -q 'Strict-Transport-Security' infra/nginx/mgx-poker.com-ssl.conf.example
grep -q 'X-Content-Type-Options' infra/nginx/mgx-poker.com-ssl.conf.example

echo "deploy static safety: PASS"
