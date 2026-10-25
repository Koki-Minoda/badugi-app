import hashlib
import json
import subprocess
from pathlib import Path

from rl.training.run_provenance import source_provenance, write_run_manifest


def _source_tree(root: Path) -> Path:
    training = root / "src" / "rl" / "training"
    training.mkdir(parents=True)
    source = training / "trainer.py"
    source.write_text("VALUE = 1\n", encoding="utf-8")
    tests = root / "src" / "rl" / "__tests__"
    tests.mkdir(parents=True)
    (tests / "test_trainer.py").write_text("ignored\n", encoding="utf-8")
    return source


def test_source_fingerprint_tracks_bytes_and_distinguishes_unknown_git(tmp_path: Path):
    source = _source_tree(tmp_path)
    first = source_provenance(tmp_path)
    assert first["git"]["status"] == "unknown"
    assert first["git"]["head"] is None
    assert first["files"] == {
        "src/rl/training/trainer.py": hashlib.sha256(source.read_bytes()).hexdigest(),
    }

    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "add", "src/rl"], cwd=tmp_path, check=True)
    subprocess.run(
        ["git", "-c", "user.name=MGX QA", "-c", "user.email=qa@mgx.invalid", "commit", "-qm", "source"],
        cwd=tmp_path, check=True,
    )
    clean = source_provenance(tmp_path)
    assert clean["git"]["status"] == "clean"
    assert clean["git"]["head"]
    assert clean["fingerprint"] == first["fingerprint"]

    source.write_text("VALUE = 2\n", encoding="utf-8")
    dirty = source_provenance(tmp_path)
    assert dirty["git"]["status"] == "dirty"
    assert dirty["fingerprint"] != clean["fingerprint"]
    assert any("trainer.py" in line for line in dirty["git"]["sourceChanges"])


def test_unique_run_manifests_keep_old_runs_and_link_to_content(tmp_path: Path):
    _source_tree(tmp_path)
    output = tmp_path / "artifacts"
    first = write_run_manifest(
        project_root=tmp_path, output_dir=output, stem="sixmax_run_manifest",
        payload={"schemaVersion": "example-v1", "config": {"episodes": 10}},
    )
    first_content = first.path.read_bytes()
    second = write_run_manifest(
        project_root=tmp_path, output_dir=output, stem="sixmax_run_manifest",
        payload={"schemaVersion": "example-v1", "config": {"episodes": 20}},
    )
    assert first.path != second.path
    assert first.path.read_bytes() == first_content
    assert second.latest_path.read_bytes() == second.path.read_bytes()
    assert first.sha256 == hashlib.sha256(first_content).hexdigest()
    assert second.metadata()["runManifestSha256"] == hashlib.sha256(second.path.read_bytes()).hexdigest()
    assert json.loads(first_content)["runId"] == first.run_id
    assert json.loads(second.path.read_text(encoding="utf-8"))["config"]["episodes"] == 20
