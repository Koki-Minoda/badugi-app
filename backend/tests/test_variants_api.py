from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import close_all_sessions, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import db
from app.db.seeds.variants import seed_variants
from app.main import app
from app.models import Base

client = TestClient(app)


def setup_sqlite(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionTesting)
    session = SessionTesting()
    try:
        seed_variants(session)
    finally:
        session.close()
    return engine, SessionTesting


def teardown_sqlite(engine):
    close_all_sessions()
    engine.dispose()


def test_list_variants_returns_seeded_variants(monkeypatch):
    engine, _ = setup_sqlite(monkeypatch)
    try:
        response = client.get("/api/variants")
        assert response.status_code == 200
        payload = response.json()
        keys = {variant["variant_key"] for variant in payload}
        assert {"badugi", "plo", "double_board_bomb_pot_omaha"}.issubset(keys)
    finally:
        teardown_sqlite(engine)


def test_get_double_board_bomb_pot_omaha(monkeypatch):
    engine, _ = setup_sqlite(monkeypatch)
    try:
        response = client.get("/api/variants/double_board_bomb_pot_omaha")
        assert response.status_code == 200
        payload = response.json()
        assert payload["variant_key"] == "double_board_bomb_pot_omaha"
        assert payload["forced_bets"]["type"] == "bombPot"
        assert payload["betting"]["hasPreflop"] is False
        assert payload["boards"]["count"] == 2
    finally:
        teardown_sqlite(engine)


def test_missing_variant_returns_404(monkeypatch):
    engine, _ = setup_sqlite(monkeypatch)
    try:
        response = client.get("/api/variants/not_a_variant")
        assert response.status_code == 404
    finally:
        teardown_sqlite(engine)


def test_seed_variants_is_idempotent(monkeypatch):
    engine, SessionTesting = setup_sqlite(monkeypatch)
    try:
        session = SessionTesting()
        try:
            seed_variants(session)
            seed_variants(session)
        finally:
            session.close()

        response = client.get("/api/variants")
        assert response.status_code == 200
        keys = [variant["variant_key"] for variant in response.json()]
        assert keys.count("double_board_bomb_pot_omaha") == 1
        assert len(keys) == 5
    finally:
        teardown_sqlite(engine)
