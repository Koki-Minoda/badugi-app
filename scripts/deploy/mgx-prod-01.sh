#!/usr/bin/env bash
# Deployment helper for mgx-prod-01 VPS (make sure to `chmod +x scripts/deploy/mgx-prod-01.sh`)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/badugi-app}"
FRONTEND_DIST="$APP_DIR/dist"
DEPLOY_TARGET="/var/www/mgx-poker"
DEFAULT_BRANCH="main"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-$DEFAULT_BRANCH}"

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

echo "[mgx-deploy] restarting backend service"
sudo systemctl restart mgx-backend.service

echo "[mgx-deploy] testing nginx config"
sudo nginx -t

echo "[mgx-deploy] reloading nginx"
sudo systemctl reload nginx

echo "[mgx-deploy] deployment complete"
