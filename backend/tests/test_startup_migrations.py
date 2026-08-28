from __future__ import annotations

from types import SimpleNamespace

import pytest

from app import main


def test_production_startup_upgrades_before_revision_check(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(main, "settings", SimpleNamespace(backend_env="prod"))
    monkeypatch.setattr(main, "_upgrade_database_to_head", lambda: calls.append("upgrade"))
    monkeypatch.setattr(main, "_assert_migrations_up_to_date", lambda: calls.append("check"))

    main.bootstrap_schema()

    assert calls == ["upgrade", "check"]


def test_production_startup_fails_closed_when_upgrade_fails(monkeypatch) -> None:
    monkeypatch.setattr(main, "settings", SimpleNamespace(backend_env="prod"))

    def fail_upgrade() -> None:
        raise RuntimeError("migration failed")

    monkeypatch.setattr(main, "_upgrade_database_to_head", fail_upgrade)
    monkeypatch.setattr(
        main,
        "_assert_migrations_up_to_date",
        lambda: pytest.fail("revision check must not run after a failed upgrade"),
    )

    with pytest.raises(RuntimeError, match="migration failed"):
        main.bootstrap_schema()


def test_test_environment_never_runs_migrations(monkeypatch) -> None:
    monkeypatch.setattr(main, "settings", SimpleNamespace(backend_env="test"))
    monkeypatch.setattr(
        main,
        "_upgrade_database_to_head",
        lambda: pytest.fail("test startup must not migrate"),
    )

    main.bootstrap_schema()
