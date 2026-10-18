#!/usr/bin/env bash
# One-time administrator setup. No application code runs as root.
set -euo pipefail
test "$(id -u)" -eq 0 || { echo "Run this installer with sudo." >&2; exit 1; }
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stage="$(mktemp -d /root/mgx-deploy-admin.XXXXXX)"
trap 'rm -rf -- "$stage"' EXIT

# Validate private copies, so the deploy user cannot race a source edit after
# verification. These are the exact reviewed helper sources, not repo HEAD.
for file in mgx-prod-admin.py configure-mgx-backend-workers.sh ensure_mgx_nginx_websocket_proxy.sh; do
  cp -- "$SOURCE_DIR/$file" "$stage/$file"
done
(
  cd "$stage"
  sha256sum -c <<'HASHES'
7791ac5fc52fa4779de61ee920c0711361580dacf1cc7e2485f0973ca741cd7d  mgx-prod-admin.py
74d6723150b911f9522fe3166a74ef2ea741bd181e84c28f7d5e32d55ff5e648  configure-mgx-backend-workers.sh
da8d32315df221f122d4e0d93313b16c3ae73a611348f7e65c0ce5d6e82c1cd3  ensure_mgx_nginx_websocket_proxy.sh
HASHES
)

/usr/bin/python3 -I - <<'PY'
from pathlib import Path
import stat
for name in ("/usr/local/sbin", "/usr/local/libexec/mgx-deploy", "/etc/sudoers.d", "/var/backups/mgx-deploy-admin"):
    path = Path(name)
    for parent in (path, *path.parents):
        if not parent.exists() and not parent.is_symlink():
            continue
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit(f"Unsafe administrator directory: {parent}")
PY
test "$(systemctl show mgx-backend.service --property=User --value)" = mgx || {
  echo "Backend must run as mgx before installing this helper." >&2; exit 1;
}

cat >"$stage/sudoers" <<'SUDOERS'
# Only fixed, root-owned MGX deployment operations. No shell or wildcard grant.
mgx ALL=(root) NOPASSWD: /usr/local/sbin/mgx-prod-admin check, /usr/local/sbin/mgx-prod-admin workers, /usr/local/sbin/mgx-prod-admin nginx-ws
SUDOERS
/usr/sbin/visudo -cf "$stage/sudoers"
install -d -o root -g root -m 0755 /usr/local/libexec/mgx-deploy
backup="/var/backups/mgx-deploy-admin/$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -o root -g root -m 0700 "$backup"
for path in /usr/local/sbin/mgx-prod-admin /usr/local/libexec/mgx-deploy/configure-mgx-backend-workers.sh /usr/local/libexec/mgx-deploy/ensure_mgx_nginx_websocket_proxy.sh /etc/sudoers.d/mgx-deploy-admin; do
  test ! -L "$path" || { echo "Refusing to replace symlink: $path" >&2; exit 1; }
  if test -e "$path"; then
    cp -p -- "$path" "$backup/$(basename "$(dirname "$path")")-$(basename "$path")"
  fi
done
install -o root -g root -m 0755 "$stage/mgx-prod-admin.py" /usr/local/sbin/mgx-prod-admin
for file in configure-mgx-backend-workers.sh ensure_mgx_nginx_websocket_proxy.sh; do
  install -o root -g root -m 0644 "$stage/$file" "/usr/local/libexec/mgx-deploy/$file"
done
/usr/local/sbin/mgx-prod-admin check
install -o root -g root -m 0440 "$stage/sudoers" /etc/sudoers.d/mgx-deploy-admin
if ! /usr/sbin/visudo -c; then
  if test -f "$backup/sudoers.d-mgx-deploy-admin"; then
    cp -p -- "$backup/sudoers.d-mgx-deploy-admin" /etc/sudoers.d/mgx-deploy-admin
  else
    rm -f -- /etc/sudoers.d/mgx-deploy-admin
  fi
  exit 1
fi
echo "MGX deployment helper installed. Previous files: $backup"
echo "Application packages and services were not restarted by this setup."
