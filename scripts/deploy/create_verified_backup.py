#!/usr/bin/env python3
"""Save and verify the current MGX frontend and MySQL database before deploy."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _database_settings(app_dir: Path) -> tuple[list[str], dict[str, str], str]:
    values = {**dotenv_values(app_dir / "backend" / ".env"), **os.environ}
    if values.get("BACKEND_DB_DRIVER", "mysql").lower() not in {"mysql", "mariadb"}:
        raise RuntimeError("production backup requires a MySQL database")
    name = values.get("BACKEND_DB_NAME") or "mgx_prod"
    if not re.fullmatch(r"[A-Za-z0-9_]+", name):
        raise RuntimeError("invalid database name")
    password = values.get("BACKEND_DB_PASSWORD")
    if not password:
        raise RuntimeError("missing database password")
    host = values.get("BACKEND_DB_HOST") or "localhost"
    port = values.get("BACKEND_DB_PORT") or "3306"
    user = values.get("BACKEND_DB_USER") or "mgx"
    if not port.isdigit() or not (1 <= int(port) <= 65535):
        raise RuntimeError("invalid database port")
    options = ["--protocol=TCP", "--host", host, "--port", port, "--user", user]
    environment = {**os.environ, "MYSQL_PWD": password}
    return options, environment, name


def _mysql_binary(*names: str) -> str:
    binary = next((path for name in names if (path := shutil.which(name))), None)
    if binary is None:
        raise RuntimeError(f"missing database client: {' or '.join(names)}")
    return binary


def run_backup(
    app_dir: Path,
    frontend_dir: Path,
    backup_root: Path,
    expected_commit: str,
) -> Path:
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit):
        raise RuntimeError("expected commit must be a full Git SHA")
    current_commit = subprocess.check_output(
        ["git", "-C", str(app_dir), "rev-parse", "HEAD"], text=True
    ).strip()
    release = json.loads((frontend_dir / "release.json").read_text(encoding="utf-8"))
    if release.get("commit") != current_commit:
        raise RuntimeError("current frontend release does not match the server checkout")
    if not (frontend_dir / "index.html").is_file() or not (frontend_dir / "assets").is_dir():
        raise RuntimeError("current frontend is incomplete")

    options, environment, database = _database_settings(app_dir)
    mysql = _mysql_binary("mysql", "mariadb")
    dump = _mysql_binary("mysqldump", "mariadb-dump")
    version = subprocess.run(
        [mysql, *options, "--batch", "--skip-column-names", database,
         "--execute", "SELECT version_num FROM alembic_version"],
        env=environment, capture_output=True, text=True, check=True,
    ).stdout.strip()
    if not re.fullmatch(r"[A-Za-z0-9_]+", version):
        raise RuntimeError("could not verify the Alembic revision")

    backup_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup_root.chmod(0o700)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    destination = backup_root / f"{stamp}-before-{expected_commit[:12]}"
    destination.mkdir(mode=0o700)
    try:
        frontend_archive = destination / "frontend.tar.gz"
        with tarfile.open(frontend_archive, "w:gz") as archive:
            archive.add(frontend_dir, arcname="frontend")
        with tarfile.open(frontend_archive, "r:gz") as archive:
            names = set(archive.getnames())
            if not {"frontend/index.html", "frontend/release.json"}.issubset(names):
                raise RuntimeError("frontend archive is incomplete")
            if not any(name.startswith("frontend/assets/") for name in names):
                raise RuntimeError("frontend assets are absent from archive")
            frontend_files = sum(member.isfile() for member in archive.getmembers())

        database_archive = destination / "database.sql.gz"
        process = subprocess.Popen(
            [dump, *options, "--single-transaction", "--quick", "--hex-blob", database],
            env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert process.stdout is not None
        with gzip.open(database_archive, "wb") as archive:
            shutil.copyfileobj(process.stdout, archive)
        process.stdout.close()
        assert process.stderr is not None
        process.stderr.read()
        if process.wait() != 0:
            raise RuntimeError("database dump failed")
        with gzip.open(database_archive, "rb") as archive:
            database_bytes = 0
            has_schema = False
            for chunk in iter(lambda: archive.read(1024 * 1024), b""):
                database_bytes += len(chunk)
                has_schema = has_schema or b"CREATE TABLE" in chunk
        if database_bytes < 1024 or not has_schema:
            raise RuntimeError("database dump is incomplete")

        manifest = {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "sourceCommit": current_commit,
            "targetCommit": expected_commit,
            "alembicRevision": version,
            "frontendFiles": frontend_files,
            "databaseBytes": database_bytes,
            "frontendSha256": _digest(frontend_archive),
            "databaseSha256": _digest(database_archive),
            "status": "PASS",
        }
        (destination / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps({"backupDirectory": str(destination), **manifest}))
        return destination
    except BaseException:
        shutil.rmtree(destination)
        raise


if __name__ == "__main__":
    try:
        run_backup(
            Path("/home/mgx/badugi-app"),
            Path("/var/www/mgx-poker"),
            Path.home() / "mgx-backups" / "releases",
            sys.argv[1],
        )
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"[mgx-backup] failed: {error}", file=sys.stderr)
        sys.exit(1)
