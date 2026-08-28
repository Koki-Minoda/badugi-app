#!/usr/bin/env python3
"""Run a command with values from a dotenv file without shell evaluation."""

from __future__ import annotations

import os
from pathlib import Path
import sys

from dotenv import dotenv_values


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit("usage: run-with-dotenv.py ENV_FILE COMMAND [ARG ...]")

    env_file = Path(argv[1])
    if not env_file.is_file():
        raise SystemExit(f"environment file does not exist: {env_file}")

    command = argv[2:]
    environment = os.environ.copy()
    environment.update(
        {
            key: value
            for key, value in dotenv_values(env_file).items()
            if key and value is not None
        }
    )
    os.execvpe(command[0], command, environment)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
