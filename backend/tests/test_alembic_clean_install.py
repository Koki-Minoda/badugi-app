import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_alembic_clean_install_creates_every_runtime_table(tmp_path: Path):
    database_path = tmp_path / "clean-install.db"
    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env.update(
        {
            "BACKEND_ENV": "test",
            "BACKEND_DB_DRIVER": "sqlite",
            "BACKEND_DB_NAME": str(database_path),
        }
    )

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        connection.execute(
            """
            INSERT INTO badugi_action_logs
                (hand_id, player_id, phase, round, action, action_type, paid,
                 is_forced, seq)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("clean-hand", "player-1", "BET", 0, "Check", "check", 0, 0, 0),
        )
        generated_action_id = connection.execute(
            "SELECT id FROM badugi_action_logs WHERE hand_id = ?", ("clean-hand",)
        ).fetchone()

    assert {
        "users",
        "badugi_hand_logs",
        "badugi_hand_actions",
        "badugi_hand_results",
        "badugi_action_logs",
        "tournament_snapshots",
        "play_feedback_results",
        "p2p_room_states",
    } <= tables
    assert generated_action_id is not None
    assert generated_action_id[0] > 0


def test_reconciliation_preserves_preexisting_user_data(tmp_path: Path):
    database_path = tmp_path / "existing-install.db"
    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env.update(
        {
            "BACKEND_ENV": "test",
            "BACKEND_DB_DRIVER": "sqlite",
            "BACKEND_DB_NAME": str(database_path),
        }
    )

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "20260827_01"],
        cwd=backend_dir,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.models import Base; from app.core.db import engine; "
            "Base.metadata.create_all(engine)",
        ],
        cwd=backend_dir,
        env=env,
        check=True,
    )
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "INSERT INTO users (name, email, hashed_password) VALUES (?, ?, ?)",
            ("Existing", "existing@example.com", "hash"),
        )
        connection.commit()

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT name FROM users WHERE email = ?", ("existing@example.com",)
        ).fetchone() == ("Existing",)
        connection.execute(
            """
            INSERT INTO badugi_action_logs
                (hand_id, player_id, phase, round, action, action_type, paid,
                 is_forced, seq)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("existing-hand", "player-1", "BET", 0, "Check", "check", 0, 0, 0),
        )
        assert connection.execute(
            "SELECT id FROM badugi_action_logs WHERE hand_id = ?", ("existing-hand",)
        ).fetchone()[0] > 0
