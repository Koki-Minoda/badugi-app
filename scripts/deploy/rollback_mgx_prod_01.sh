#!/usr/bin/env bash
# Restore latest dist backup (run `chmod +x scripts/deploy/rollback_mgx_prod_01.sh`)
set -euo pipefail

DIST_BACKUP_DIR="/var/backups/mgx/dist"
TARGET_DIR="/var/www/mgx-poker"

LATEST=""
for candidate in "${DIST_BACKUP_DIR}"/mgx-dist-*.tar.gz; do
  [ -e "$candidate" ] || continue
  if [ -z "$LATEST" ] || [ "$candidate" -nt "$LATEST" ]; then
    LATEST="$candidate"
  fi
done
if [ -z "$LATEST" ]; then
  echo "[rollback] no dist backups found in ${DIST_BACKUP_DIR}" >&2
  exit 1
fi

echo "[rollback] restoring ${LATEST}"
restore_dir="$(mktemp -d /tmp/mgx-dist-rollback.XXXXXX)"
trap 'sudo rm -rf -- "$restore_dir"' EXIT
sudo tar tzf "$LATEST" >/dev/null
sudo tar xzf "$LATEST" -C "$restore_dir"
sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete "${restore_dir}/" "$TARGET_DIR/"

echo "[rollback] dist restored. Consider reloading nginx or restarting services if needed."
