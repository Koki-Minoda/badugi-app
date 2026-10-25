"""The production backup gate must leave a verified, restorable artifact."""

import importlib.util
import json
import os
import subprocess
import tarfile
from pathlib import Path

import pytest


BACKUP_SCRIPT = Path(__file__).resolve().parents[2] / "scripts/deploy/create_verified_backup.py"
SPEC = importlib.util.spec_from_file_location("create_verified_backup", BACKUP_SCRIPT)
assert SPEC and SPEC.loader
backup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup)


def _fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    app = tmp_path / "app"
    app.mkdir()
    subprocess.run(["git", "init", "-q", str(app)], check=True)
    subprocess.run(["git", "-C", str(app), "-c", "user.name=Test", "-c",
                    "user.email=test@example.com", "commit", "-q", "--allow-empty",
                    "-m", "current"], check=True)
    commit = subprocess.check_output(["git", "-C", str(app), "rev-parse", "HEAD"], text=True).strip()
    (app / "backend").mkdir()
    (app / "backend/.env").write_text(
        "BACKEND_DB_DRIVER=mysql\nBACKEND_DB_NAME=mgx_prod\n"
        "BACKEND_DB_USER=mgx\nBACKEND_DB_PASSWORD=private-test-password\n",
        encoding="utf-8",
    )
    frontend = tmp_path / "frontend"
    (frontend / "assets").mkdir(parents=True)
    (frontend / "index.html").write_text("<html></html>", encoding="utf-8")
    (frontend / "release.json").write_text(json.dumps({"commit": commit}), encoding="utf-8")
    (frontend / "assets/app.js").write_text("export {};", encoding="utf-8")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "mysql").write_text("#!/bin/sh\nprintf '20261025_01\n'\n", encoding="utf-8")
    (bin_dir / "mysqldump").write_text(
        "#!/bin/sh\nprintf 'CREATE TABLE test (id int);\n'\n"
        "head -c 2048 /dev/zero | tr '\\000' 'x'\n",
        encoding="utf-8",
    )
    for binary in bin_dir.iterdir():
        binary.chmod(0o700)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.delenv("BACKEND_DB_DRIVER", raising=False)
    monkeypatch.delenv("BACKEND_DB_NAME", raising=False)
    monkeypatch.delenv("BACKEND_DB_PASSWORD", raising=False)
    return app, frontend, tmp_path / "backups", commit, bin_dir


def test_verified_backup_contains_release_and_database(tmp_path, monkeypatch, capsys):
    app, frontend, root, commit, _ = _fixture(tmp_path, monkeypatch)
    destination = backup.run_backup(app, frontend, root, "f" * 40)
    manifest = json.loads((destination / "manifest.json").read_text())
    assert manifest["status"] == "PASS"
    assert manifest["sourceCommit"] == commit
    assert manifest["alembicRevision"] == "20261025_01"
    assert manifest["databaseBytes"] > 1024
    assert manifest["frontendSha256"] == backup._digest(destination / "frontend.tar.gz")
    assert manifest["databaseSha256"] == backup._digest(destination / "database.sql.gz")
    with tarfile.open(destination / "frontend.tar.gz") as archive:
        assert "frontend/assets/app.js" in archive.getnames()
    assert "private-test-password" not in capsys.readouterr().out


def test_release_mismatch_stops_before_writing_backup(tmp_path, monkeypatch):
    app, frontend, root, _, _ = _fixture(tmp_path, monkeypatch)
    (frontend / "release.json").write_text(json.dumps({"commit": "0" * 40}))
    with pytest.raises(RuntimeError, match="does not match"):
        backup.run_backup(app, frontend, root, "f" * 40)
    assert not root.exists()


def test_failed_dump_removes_partial_backup(tmp_path, monkeypatch):
    app, frontend, root, _, bin_dir = _fixture(tmp_path, monkeypatch)
    (bin_dir / "mysqldump").write_text("#!/bin/sh\nexit 3\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="database dump failed"):
        backup.run_backup(app, frontend, root, "f" * 40)
    assert list(root.iterdir()) == []
