#!/usr/bin/env bash
# Restore latest dist backup (run `chmod +x scripts/deploy/rollback_mgx_prod_01.sh`)
set -euo pipefail

DIST_BACKUP_DIR="/var/backups/mgx/dist"
TARGET_DIR="/var/www/mgx-poker"

LATEST="$(ls -1t ${DIST_BACKUP_DIR}/mgx-dist-*.tar.gz 2>/dev/null | head -n 1 || true)"
if [ -z "$LATEST" ]; then
  echo "[rollback] no dist backups found in ${DIST_BACKUP_DIR}" >&2
  exit 1
fi

echo "[rollback] restoring ${LATEST}"
sudo mkdir -p "$TARGET_DIR"
sudo rm -rf "${TARGET_DIR:?}/"*
sudo tar xzf "$LATEST" -C "$TARGET_DIR"

echo "[rollback] dist restored. Consider reloading nginx or restarting services if needed."
