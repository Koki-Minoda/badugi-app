from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "scripts" / "deploy" / "run-with-dotenv.py"


def test_dotenv_runner_passes_secrets_without_shell_evaluation(tmp_path: Path) -> None:
    env_file = tmp_path / "backend.env"
    output_file = tmp_path / "captured.txt"
    env_file.write_text(
        "DEPLOY_TEST_TOKEN='value with spaces $HOME ; echo unsafe'\n",
        encoding="utf-8",
    )

    command = [
        sys.executable,
        str(RUNNER),
        str(env_file),
        sys.executable,
        "-c",
        (
            "import os, pathlib, sys; "
            "pathlib.Path(sys.argv[1]).write_text(os.environ['DEPLOY_TEST_TOKEN'])"
        ),
        str(output_file),
    ]
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "HOME": "/must-not-expand"},
    )

    assert completed.returncode == 0
    assert completed.stdout == ""
    assert completed.stderr == ""
    assert output_file.read_text(encoding="utf-8") == "value with spaces $HOME ; echo unsafe"


def test_dotenv_runner_fails_closed_when_file_is_missing(tmp_path: Path) -> None:
    missing = tmp_path / "missing.env"
    completed = subprocess.run(
        [sys.executable, str(RUNNER), str(missing), sys.executable, "--version"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode != 0
    assert "environment file does not exist" in completed.stderr
