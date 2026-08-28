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
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/etc/mgx/mgx-backend.env}"

fail() {
  echo "[mgx-deploy] ERROR: $*" >&2
  exit 1
}

run_backend_migrations() {
  local env_file="$1"
  local alembic_bin
  local python_bin

  if ! sudo -n test -f "$env_file" || ! sudo -n test -r "$env_file"; then
    fail "backend environment file is not readable: ${env_file}"
  fi
  alembic_bin="$(command -v alembic)"
  python_bin="$(command -v python)"
  if [ -z "$alembic_bin" ]; then
    fail "alembic executable is unavailable in the backend virtual environment"
  fi
  if [ -z "$python_bin" ]; then
    fail "python executable is unavailable in the backend virtual environment"
  fi

  # Parse the systemd-compatible dotenv file without evaluating it as shell
  # code. The production file is intentionally root-readable only, so the
  # narrowly scoped migration child runs through non-interactive sudo. Secrets
  # stay in that child environment and are never printed or placed on argv.
  sudo -n -- "$python_bin" "$APP_DIR/scripts/deploy/run-with-dotenv.py" \
    "$env_file" "$alembic_bin" upgrade head
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

echo "[mgx-deploy] switching to ${APP_DIR}"
cd "$APP_DIR"

echo "[mgx-deploy] pulling latest code (${GIT_REMOTE}/${GIT_BRANCH})"
git fetch "$GIT_REMOTE" "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git pull "$GIT_REMOTE" "$GIT_BRANCH"

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
echo "[mgx-deploy] applying backend database migrations"
run_backend_migrations "$BACKEND_ENV_FILE"
deactivate
cd "$APP_DIR"

echo "[mgx-deploy] syncing frontend dist -> ${DEPLOY_TARGET}"
sudo mkdir -p "$DEPLOY_TARGET"
sudo rsync -av --delete "${FRONTEND_DIST}/" "${DEPLOY_TARGET}/"
verify_frontend_asset_sync

echo "[mgx-deploy] restarting backend service"
sudo systemctl restart mgx-backend.service

verify_live_frontend
verify_live_p2p_rest_route

echo "[mgx-deploy] deployment complete"
