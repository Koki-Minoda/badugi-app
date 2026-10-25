import os
from pathlib import Path
import sqlite3
import subprocess
import sys

import pytest


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
        stats_indexes = connection.execute(
            "PRAGMA index_info(ix_badugi_action_logs_player_phase_ts)"
        ).fetchall()
        assert [row[2] for row in stats_indexes] == ["player_id", "phase", "ts"]
        for table in ["badugi_hand_logs", "badugi_action_logs"]:
            index = f"ix_{table}_owner_user_id"
            assert [row[2] for row in connection.execute(f"PRAGMA index_info({index})")] == ["owner_user_id"]
            plan = connection.execute(f"EXPLAIN QUERY PLAN SELECT id FROM {table} WHERE owner_user_id = ?", (123,)).fetchall()
            assert any(index in row[3] and "SEARCH" in row[3] for row in plan)
            assert any(
                row[2] == "users" and row[3] == "owner_user_id" and row[6] == "CASCADE"
                for row in connection.execute(f"PRAGMA foreign_key_list({table})")
            )
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
        for table in ("badugi_hand_logs", "badugi_action_logs"):
            assert sum(
                row[2] == "users" and row[3] == "owner_user_id"
                for row in connection.execute(f"PRAGMA foreign_key_list({table})")
            ) == 1
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


@pytest.mark.parametrize("orphan_table", ["badugi_hand_logs", "badugi_action_logs"])
def test_owner_foreign_keys_reject_orphans_and_preserve_legacy_on_rollback(tmp_path: Path, orphan_table: str):
    database_path = tmp_path / "owner-fk.db"
    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env.update({
        "BACKEND_ENV": "test",
        "BACKEND_DB_DRIVER": "sqlite",
        "BACKEND_DB_NAME": str(database_path),
    })

    def migrate(*args, check=True):
        return subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=backend_dir, env=env, check=check, capture_output=True, text=True,
        )

    migrate("upgrade", "20261024_01")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "INSERT INTO users (id, email, hashed_password) VALUES (1, 'owner@example.com', 'hash')"
        )
        if orphan_table == "badugi_hand_logs":
            connection.execute(
                "INSERT INTO badugi_hand_logs (hand_id, owner_user_id) VALUES ('orphan', 999)"
            )
        else:
            connection.execute(
                """INSERT INTO badugi_action_logs
                    (hand_id, player_id, phase, round, action, action_type, paid,
                     is_forced, seq, owner_user_id)
                   VALUES ('orphan', 'hero', 'BET', 0, 'Check', 'check', 0, 0, 0, 999)"""
            )

    rejected = migrate("upgrade", "head", check=False)
    assert rejected.returncode != 0
    assert "orphaned owner rows" in rejected.stderr
    with sqlite3.connect(database_path) as connection:
        for table in ("badugi_hand_logs", "badugi_action_logs"):
            assert not any(row[2] == "users" for row in connection.execute(f"PRAGMA foreign_key_list({table})"))
        connection.execute(f"DELETE FROM {orphan_table} WHERE hand_id = 'orphan'")
        connection.execute("INSERT INTO badugi_hand_logs (hand_id, owner_user_id) VALUES ('owned', 1)")
        connection.execute("INSERT INTO badugi_hand_logs (hand_id) VALUES ('legacy')")
        for hand, owner in (("owned", 1), ("legacy", None)):
            connection.execute(
                """INSERT INTO badugi_action_logs
                    (hand_id, player_id, phase, round, action, action_type, paid,
                     is_forced, seq, owner_user_id)
                   VALUES (?, 'hero', 'BET', 0, 'Check', 'check', 0, 0, 0, ?)""",
                (hand, owner),
            )

    migrate("upgrade", "head")
    with sqlite3.connect(database_path) as connection:
        connection.execute("PRAGMA foreign_keys=ON")
        for table in ("badugi_hand_logs", "badugi_action_logs"):
            assert any(row[2] == "users" and row[6] == "CASCADE" for row in connection.execute(f"PRAGMA foreign_key_list({table})"))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO badugi_hand_logs (hand_id, owner_user_id) VALUES ('new-orphan', 999)")
        connection.rollback()
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """INSERT INTO badugi_action_logs
                    (hand_id, player_id, phase, round, action, action_type, paid,
                     is_forced, seq, owner_user_id)
                   VALUES ('new-orphan', 'hero', 'BET', 0, 'Check', 'check', 0, 0, 0, 999)"""
            )
        connection.rollback()
        connection.execute("DELETE FROM users WHERE id = 1")
        for table in ("badugi_hand_logs", "badugi_action_logs"):
            assert connection.execute(f"SELECT COUNT(*) FROM {table} WHERE owner_user_id = 1").fetchone()[0] == 0
            assert connection.execute(f"SELECT COUNT(*) FROM {table} WHERE owner_user_id IS NULL").fetchone()[0] == 1

    migrate("downgrade", "20261024_01")
    with sqlite3.connect(database_path) as connection:
        for table in ("badugi_hand_logs", "badugi_action_logs"):
            assert not any(row[2] == "users" for row in connection.execute(f"PRAGMA foreign_key_list({table})"))
            assert any(row[1] == "owner_user_id" for row in connection.execute(f"PRAGMA table_info({table})"))
            assert connection.execute(f"SELECT COUNT(*) FROM {table} WHERE owner_user_id IS NULL").fetchone()[0] == 1
