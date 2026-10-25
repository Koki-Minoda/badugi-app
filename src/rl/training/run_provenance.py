"""Immutable run manifests for local six-max training artifacts."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _git_provenance(project_root: Path) -> dict:
    def run(*args: str) -> str | None:
        try:
            return subprocess.run(
                ["git", "-C", str(project_root), *args],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=True,
                timeout=10,
            ).stdout.strip()
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return None

    head = run("rev-parse", "HEAD")
    porcelain = run("status", "--porcelain=v1", "--untracked-files=all", "--", "src/rl")
    return {
        "head": head,
        "status": "unknown" if porcelain is None else "dirty" if porcelain else "clean",
        "sourceChanges": porcelain.splitlines() if porcelain else [],
    }


def source_provenance(project_root: Path) -> dict:
    """Hash all local RL runtime Python sources, including dirty and untracked files."""
    root = project_root / "src" / "rl"
    files = {
        path.relative_to(project_root).as_posix(): _sha256(path)
        for path in sorted(root.rglob("*.py"))
        if "__tests__" not in path.parts and not path.name.startswith("test_")
    }
    if not files:
        raise RuntimeError(f"No training sources found under {root}")
    canonical = json.dumps(files, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return {
        "schemaVersion": "mgx-training-source-provenance-v1",
        "files": files,
        "fingerprint": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "git": _git_provenance(project_root),
    }


@dataclass(frozen=True)
class RunManifest:
    path: Path
    latest_path: Path
    run_id: str
    sha256: str
    source_fingerprint: str

    def metadata(self) -> dict:
        return {
            "runManifest": str(self.path),
            "runManifestId": self.run_id,
            "runManifestSha256": self.sha256,
            "sourceFingerprint": self.source_fingerprint,
        }


def write_run_manifest(
    *, project_root: Path, output_dir: Path, stem: str, payload: dict,
) -> RunManifest:
    """Write a unique immutable manifest and a backwards-compatible latest copy."""
    output_dir.mkdir(parents=True, exist_ok=True)
    provenance = source_provenance(project_root)
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%dT%H%M%S%fZ") + f"-{uuid4().hex[:12]}"
    body = {
        **payload,
        "generatedAt": now.isoformat(timespec="seconds"),
        "runId": run_id,
        "gitCommit": provenance["git"]["head"],
        "gitStatus": provenance["git"]["status"],
        "sourceProvenance": provenance,
    }
    content = json.dumps(body, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    path = output_dir / f"{stem}_{run_id}.json"
    with path.open("x", encoding="utf-8") as handle:
        handle.write(content)
    latest_path = output_dir / f"{stem}.json"
    temporary = output_dir / f".{stem}.{run_id}.tmp"
    try:
        temporary.write_text(content, encoding="utf-8")
        os.replace(temporary, latest_path)
    finally:
        temporary.unlink(missing_ok=True)
    return RunManifest(
        path=path,
        latest_path=latest_path,
        run_id=run_id,
        sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        source_fingerprint=provenance["fingerprint"],
    )
