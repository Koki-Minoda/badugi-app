import sqlite3

from app.core.db import _configure_sqlite_connection


def test_sqlite_connection_uses_bounded_wait_and_foreign_keys():
    connection = sqlite3.connect(":memory:")
    try:
        _configure_sqlite_connection(connection)

        busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]
        foreign_keys = connection.execute("PRAGMA foreign_keys").fetchone()[0]

        assert busy_timeout == 30_000
        assert foreign_keys == 1
    finally:
        connection.close()
