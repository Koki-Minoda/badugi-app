#!/usr/bin/env bash
# Deployment helper for mgx-prod-01 VPS (make sure to `chmod +x scripts/deploy/mgx-prod-01.sh`)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/badugi-app}"
FRONTEND_DIST="$APP_DIR/dist"
DEPLOY_TARGET="/var/www/mgx-poker"
LIVE_ORIGIN="${LIVE_ORIGIN:-https://mgx-poker.com}"
DEFAULT_BRANCH="main"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-$DEFAULT_BRANCH}"
NGINX_WASM_TYPES_SOURCE="${NGINX_WASM_TYPES_SOURCE:-$APP_DIR/infra/nginx/mgx-wasm-types.conf}"
NGINX_WASM_TYPES_DISABLED_SOURCE="${NGINX_WASM_TYPES_DISABLED_SOURCE:-$APP_DIR/infra/nginx/mgx-wasm-types.disabled}"
NGINX_WASM_TYPES_TARGET="${NGINX_WASM_TYPES_TARGET:-/etc/nginx/conf.d/mgx-wasm-types.conf}"

fail() {
  echo "[mgx-deploy] ERROR: $*" >&2
  exit 1
}

asset_refs_from_index() {
  local index_file="$1"
  if [ ! -f "$index_file" ]; then
    fail "missing index file: ${index_file}"
  fi
  grep -o '/assets/[^"]*' "$index_file" | sort || true
}

verify_frontend_asset_sync() {
  local dist_index="${FRONTEND_DIST}/index.html"
  local deployed_index="${DEPLOY_TARGET}/index.html"
  local dist_assets
  local deployed_assets

  echo "[mgx-deploy] verifying frontend asset hash sync"
  dist_assets="$(asset_refs_from_index "$dist_index")"
  deployed_assets="$(asset_refs_from_index "$deployed_index")"

  if [ -z "$dist_assets" ]; then
    fail "dist index has no /assets references"
  fi
  if [ "$dist_assets" != "$deployed_assets" ]; then
    echo "[mgx-deploy] dist assets:" >&2
    echo "$dist_assets" >&2
    echo "[mgx-deploy] deployed assets:" >&2
    echo "$deployed_assets" >&2
    fail "dist/index.html and ${DEPLOY_TARGET}/index.html asset hashes differ"
  fi
}

verify_live_frontend() {
  local attempt
  local max_attempts="${HEALTH_CHECK_MAX_ATTEMPTS:-12}"
  local retry_seconds="${HEALTH_CHECK_RETRY_SECONDS:-5}"
  local live_index
  local live_manifest
  local live_health
  local expected_assets

  echo "[mgx-deploy] verifying live frontend at ${LIVE_ORIGIN}"
  expected_assets="$(asset_refs_from_index "${FRONTEND_DIST}/index.html")"

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if live_index="$(curl -fsSL "${LIVE_ORIGIN}/")" &&
      live_manifest="$(curl -fsSL "${LIVE_ORIGIN}/manifest.webmanifest")" &&
      live_health="$(curl -fsSL "${LIVE_ORIGIN}/api/health")"; then
      break
    fi

    if ((attempt == max_attempts)); then
      fail "live endpoints did not become ready after ${max_attempts} attempts"
    fi

    echo "[mgx-deploy] live endpoints not ready (attempt ${attempt}/${max_attempts}); retrying in ${retry_seconds}s"
    sleep "$retry_seconds"
  done

  while IFS= read -r asset_ref; do
    if [ -z "$asset_ref" ]; then
      continue
    fi
    if ! grep -Fq "$asset_ref" <<<"$live_index"; then
      echo "[mgx-deploy] live index:" >&2
      echo "$live_index" >&2
      fail "live index does not reference expected asset ${asset_ref}"
    fi
  done <<<"$expected_assets"

  if grep -qi '<!doctype html' <<<"$live_manifest"; then
    fail "manifest.webmanifest returned SPA HTML fallback"
  fi
  if ! grep -q '"name"' <<<"$live_manifest"; then
    fail "manifest.webmanifest does not look like JSON manifest"
  fi

  if ! grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$live_health"; then
    fail "api health status is not ok: ${live_health}"
  fi
  if ! grep -q '"env"[[:space:]]*:[[:space:]]*"prod"' <<<"$live_health"; then
    fail "api health env is not prod: ${live_health}"
  fi
  if ! grep -q '"db"[[:space:]]*:[[:space:]]*"ok"' <<<"$live_health"; then
    fail "api health db is not ok: ${live_health}"
  fi
}

verify_live_p2p_rest_route() {
  local p2p_status
  echo "[mgx-deploy] verifying authenticated P2P REST fallback route"
  p2p_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    "${LIVE_ORIGIN}/api/p2p/rooms/INVALID/state" || true)"
  if [ "$p2p_status" != "401" ]; then
    fail "P2P REST route did not enforce authentication (expected 401, got ${p2p_status})"
  fi
}

configure_nginx_wasm_mime() {
  echo "[mgx-deploy] configuring WebAssembly MIME type"
  test -f "$NGINX_WASM_TYPES_SOURCE"
  test -f "$NGINX_WASM_TYPES_DISABLED_SOURCE"

  if ! sudo -n rsync -a "$NGINX_WASM_TYPES_SOURCE" "$NGINX_WASM_TYPES_TARGET"; then
    echo "[mgx-deploy] WARN: deploy identity cannot provision nginx MIME config; browser ArrayBuffer fallback remains supported"
    return 0
  fi
  if ! sudo -n /usr/sbin/nginx -t; then
    echo "[mgx-deploy] nginx rejected WASM MIME configuration; rolling back" >&2
    sudo -n rsync -a "$NGINX_WASM_TYPES_DISABLED_SOURCE" "$NGINX_WASM_TYPES_TARGET"
    sudo -n /usr/sbin/nginx -t
    fail "nginx WASM MIME configuration failed validation"
  fi
  sudo -n systemctl reload nginx
}

verify_live_onnx_wasm() {
  local headers
  local content_type
  local wasm_url="${LIVE_ORIGIN}/assets/ort-wasm-simd-threaded.jsep.wasm"

  echo "[mgx-deploy] verifying live ONNX WASM response"
  headers="$(curl -fsSIL "$wasm_url" | tr -d '\r')"
  content_type="$(awk 'BEGIN { IGNORECASE=1 } /^content-type:/ { print tolower($2); exit }' <<<"$headers")"
  if [[ "$content_type" != application/wasm* ]] && [[ "$content_type" != application/octet-stream* ]]; then
    fail "live ONNX WASM uses unsupported content type: ${content_type:-missing}"
  fi
  if [[ "$content_type" == application/octet-stream* ]]; then
    echo "[mgx-deploy] WARN: ONNX WASM uses octet-stream; live browser QA must confirm the supported ArrayBuffer path"
  fi
  if ! grep -qi '^content-length:[[:space:]]*[1-9][0-9]\{6,\}$' <<<"$headers"; then
    fail "live ONNX WASM response is unexpectedly small"
  fi
}

verify_backend_after_restart() {
  local attempt
  local max_attempts="${BACKEND_HEALTH_MAX_ATTEMPTS:-12}"
  local retry_seconds="${BACKEND_HEALTH_RETRY_SECONDS:-5}"
  local live_health

  echo "[mgx-deploy] waiting for migrated backend health"
  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if live_health="$(curl -fsSL "${LIVE_ORIGIN}/api/health")" &&
      grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$live_health" &&
      grep -q '"env"[[:space:]]*:[[:space:]]*"prod"' <<<"$live_health" &&
      grep -q '"db"[[:space:]]*:[[:space:]]*"ok"' <<<"$live_health"; then
      return 0
    fi
    if ((attempt == max_attempts)); then
      fail "backend did not become healthy after startup migrations"
    fi
    sleep "$retry_seconds"
  done
}

echo "[mgx-deploy] switching to ${APP_DIR}"
cd "$APP_DIR"

echo "[mgx-deploy] pulling latest code (${GIT_REMOTE}/${GIT_BRANCH})"
git fetch "$GIT_REMOTE" "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git pull "$GIT_REMOTE" "$GIT_BRANCH"

configure_nginx_wasm_mime

echo "[mgx-deploy] installing frontend dependencies"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/tmp/mgx-npm-cache-$(id -u)}"
install -d -m 700 "$NPM_CACHE_DIR"

# Older production runs left a partially installed, root-owned dependency
# tree. npm cannot reliably repair that tree in place, so remove only this
# generated directory and recreate it from package-lock.json.
if [ -d "node_modules" ]; then
  test "$APP_DIR" = "$(pwd)"
  test "$APP_DIR" != "/"
  rm -rf -- "$APP_DIR/node_modules"
fi

env npm_config_cache="$NPM_CACHE_DIR" npm ci --legacy-peer-deps

echo "[mgx-deploy] building frontend"
npm run build
npm run test:build:onnx

echo "[mgx-deploy] installing backend dependencies"
cd backend
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "[mgx-deploy] missing backend/.venv (create it before running this script)"
  exit 1
fi
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "pyproject.toml" ]; then
  pip install -e .
else
  echo "[mgx-deploy] missing backend requirements.txt or pyproject.toml"
  exit 1
fi
deactivate
cd "$APP_DIR"

echo "[mgx-deploy] restarting backend service (startup applies migrations)"
sudo systemctl restart mgx-backend.service
verify_backend_after_restart

echo "[mgx-deploy] syncing frontend dist -> ${DEPLOY_TARGET}"
sudo mkdir -p "$DEPLOY_TARGET"
sudo rsync -av --delete "${FRONTEND_DIST}/" "${DEPLOY_TARGET}/"
verify_frontend_asset_sync

verify_live_frontend
verify_live_onnx_wasm
verify_live_p2p_rest_route

echo "[mgx-deploy] deployment complete"
