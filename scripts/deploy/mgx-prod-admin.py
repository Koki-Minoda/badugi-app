#!/usr/bin/python3 -I
"""Root-owned entry point for two fixed MGX deployment operations."""

import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys

ROOT = Path("/usr/local/libexec/mgx-deploy")
SOURCES = {
    "configure-mgx-backend-workers.sh": "74d6723150b911f9522fe3166a74ef2ea741bd181e84c28f7d5e32d55ff5e648",
    "ensure_mgx_nginx_websocket_proxy.sh": "da8d32315df221f122d4e0d93313b16c3ae73a611348f7e65c0ce5d6e82c1cd3",
}
ACTIONS = {
    "workers": "configure-mgx-backend-workers.sh",
    "nginx-ws": "ensure_mgx_nginx_websocket_proxy.sh",
}
ENV = {
    "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
    "HOME": "/root",
    "LANG": "C.UTF-8",
    "APP_DIR": "/home/mgx/badugi-app",
    "MGX_BACKEND_SERVICE": "mgx-backend.service",
    "MGX_BACKEND_WORKERS": "2",
}


def verify_sources(root=ROOT):
    for path in (root, *root.parents, *(root / name for name in SOURCES)):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise RuntimeError(f"Unsafe deployment helper ownership or permissions: {path}")
    for name, expected in SOURCES.items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(f"Deployment helper source changed: {name}")


def main(argv):
    if len(argv) != 1 or argv[0] not in (*ACTIONS, "check"):
        raise RuntimeError("Expected exactly one operation: check, workers, or nginx-ws")
    if os.geteuid() != 0:
        raise RuntimeError("Run the installed helper through sudo")
    verify_sources()
    service_user = subprocess.run(
        ["/usr/bin/systemctl", "show", "mgx-backend.service", "--property=User", "--value"],
        env=ENV, cwd="/", check=True, capture_output=True, text=True, timeout=10,
    ).stdout.strip()
    if service_user != "mgx":
        raise RuntimeError("Refusing to restart a backend that does not run as mgx")
    if argv[0] == "check":
        print("MGX deploy admin readiness: PASS")
        return
    subprocess.run(
        ["/bin/bash", str(ROOT / ACTIONS[argv[0]])],
        env=ENV, cwd="/", check=True,
    )


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"MGX deploy admin: {error}", file=sys.stderr)
        sys.exit(1)
