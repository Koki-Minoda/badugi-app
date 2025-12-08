#!/usr/bin/env bash
# Backup helper for mgx-prod-01 (run `chmod +x scripts/deploy/backup_mgx_prod_01.sh`)
set -euo pipefail

ts="$(date +"%Y%m%d-%H%M%S")"
DIST_DIR="/var/www/mgx-poker"
BACKUP_ROOT="/var/backups/mgx"
DIST_BACKUP="${BACKUP_ROOT}/dist"
DB_BACKUP="${BACKUP_ROOT}/db"

echo "[backup] creating backup directories"
sudo mkdir -p "$DIST_BACKUP" "$DB_BACKUP"

echo "[backup] archiving dist (${DIST_DIR})"
sudo tar czf "${DIST_BACKUP}/mgx-dist-${ts}.tar.gz" -C "$DIST_DIR" .

echo "[backup] dumping database"
# NOTE: replace DB_NAME / DB_USER / DB_PASS with actual credentials or use ~/.my.cnf
mysqldump -u DB_USER -pDB_PASS DB_NAME > "${DB_BACKUP}/mgx-db-${ts}.sql"

echo "[backup] completed: dist -> ${DIST_BACKUP}/mgx-dist-${ts}.tar.gz ; db -> ${DB_BACKUP}/mgx-db-${ts}.sql"
