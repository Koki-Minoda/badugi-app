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
  local live_index
  local live_manifest
  local live_health
  local expected_assets

  echo "[mgx-deploy] verifying live frontend at ${LIVE_ORIGIN}"
  expected_assets="$(asset_refs_from_index "${FRONTEND_DIST}/index.html")"
  live_index="$(curl -fsSL "${LIVE_ORIGIN}/")" || fail "failed to fetch ${LIVE_ORIGIN}/"

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

  live_manifest="$(curl -fsSL "${LIVE_ORIGIN}/manifest.webmanifest")" ||
    fail "failed to fetch ${LIVE_ORIGIN}/manifest.webmanifest"
  if grep -qi '<!doctype html' <<<"$live_manifest"; then
    fail "manifest.webmanifest returned SPA HTML fallback"
  fi
  if ! grep -q '"name"' <<<"$live_manifest"; then
    fail "manifest.webmanifest does not look like JSON manifest"
  fi

  live_health="$(curl -fsSL "${LIVE_ORIGIN}/api/health")" ||
    fail "failed to fetch ${LIVE_ORIGIN}/api/health"
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

echo "[mgx-deploy] switching to ${APP_DIR}"
cd "$APP_DIR"

echo "[mgx-deploy] pulling latest code (${GIT_REMOTE}/${GIT_BRANCH})"
git fetch "$GIT_REMOTE" "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git pull "$GIT_REMOTE" "$GIT_BRANCH"

echo "[mgx-deploy] installing frontend dependencies"
npm install --legacy-peer-deps

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
deactivate
cd "$APP_DIR"

echo "[mgx-deploy] syncing frontend dist -> ${DEPLOY_TARGET}"
sudo mkdir -p "$DEPLOY_TARGET"
sudo rsync -av --delete "${FRONTEND_DIST}/" "${DEPLOY_TARGET}/"
verify_frontend_asset_sync

echo "[mgx-deploy] restarting backend service"
sudo systemctl restart mgx-backend.service

echo "[mgx-deploy] testing nginx config"
sudo nginx -t

echo "[mgx-deploy] reloading nginx"
sudo systemctl reload nginx
verify_live_frontend

echo "[mgx-deploy] deployment complete"
