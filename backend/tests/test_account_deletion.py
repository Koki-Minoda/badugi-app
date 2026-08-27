from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import close_all_sessions, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import db
from app.main import app
from app.models import Base, PlayFeedbackResult, TournamentSnapshot, User
from app.p2p.manager import p2p_room_manager


PASSWORD = "Delete-Me-2026!"


def _setup_database(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        future=True,
    )
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", session_factory)
    return engine, session_factory


def _signup_and_login(client: TestClient, email: str) -> str:
    signup = client.post(
        "/api/auth/signup",
        json={"email": email, "password": PASSWORD},
    )
    assert signup.status_code == 201
    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_delete_account_requires_current_password_and_removes_linked_data(monkeypatch):
    engine, session_factory = _setup_database(monkeypatch)
    client = TestClient(app)
    host_email = "delete-host@example.com"
    guest_email = "delete-guest@example.com"
    try:
        host_token = _signup_and_login(client, host_email)
        guest_token = _signup_and_login(client, guest_email)

        created = client.post(
            "/api/p2p/rooms",
            headers=_auth(host_token),
            json={"variantId": "badugi"},
        )
        assert created.status_code == 200
        room_code = created.json()["roomCode"]
        assert client.post(
            "/api/p2p/rooms/join",
            headers=_auth(guest_token),
            json={"roomCode": room_code},
        ).status_code == 200

        with session_factory() as session:
            host = session.execute(
                select(User).where(User.email == host_email),
            ).scalar_one()
            host_id = host.id
            session.add(
                TournamentSnapshot(
                    user_id=host_id,
                    snapshot={"tournamentId": "delete-me"},
                ),
            )
            session.add(
                PlayFeedbackResult(
                    user_id=host_id,
                    session_key="delete-me",
                    mode="tournament",
                    variant_scope="badugi",
                    tournament_id="delete-me",
                    hand_count=1,
                    source="fallback",
                    pii_removed=True,
                    payload={"private": "context"},
                    response={"summary": "private"},
                ),
            )
            session.commit()

        wrong_password = client.request(
            "DELETE",
            "/api/auth/account",
            headers=_auth(host_token),
            json={"password": "wrong-password"},
        )
        assert wrong_password.status_code == 403
        assert wrong_password.json()["detail"] == "invalid_password"
        assert wrong_password.headers["cache-control"] == "private, no-store"
        assert client.get("/api/auth/me", headers=_auth(host_token)).status_code == 200

        empty_password = client.request(
            "DELETE",
            "/api/auth/account",
            headers=_auth(host_token),
            json={"password": ""},
        )
        assert empty_password.status_code == 422

        deleted = client.request(
            "DELETE",
            "/api/auth/account",
            headers=_auth(host_token),
            json={"password": PASSWORD},
        )
        assert deleted.status_code == 200
        assert deleted.json() == {"deleted": True}
        assert deleted.headers["cache-control"] == "private, no-store"
        assert deleted.headers["pragma"] == "no-cache"

        with session_factory() as session:
            assert session.get(User, host_id) is None
            assert session.scalar(
                select(TournamentSnapshot).where(TournamentSnapshot.user_id == host_id),
            ) is None
            assert session.scalar(
                select(PlayFeedbackResult).where(PlayFeedbackResult.user_id == host_id),
            ) is None

        assert client.get("/api/auth/me", headers=_auth(host_token)).status_code == 401
        assert client.get(
            f"/api/p2p/rooms/{room_code}/state",
            headers=_auth(guest_token),
        ).status_code == 404
        assert p2p_room_manager.room_codes_for_user(str(host_id)) == []

        # The deleted identity no longer reserves its email address.
        assert client.post(
            "/api/auth/signup",
            json={"email": host_email, "password": PASSWORD},
        ).status_code == 201
    finally:
        p2p_room_manager.reset()
        app.dependency_overrides.clear()
        close_all_sessions()
        engine.dispose()


def test_delete_account_requires_authentication(monkeypatch):
    engine, _ = _setup_database(monkeypatch)
    try:
        response = TestClient(app).request(
            "DELETE",
            "/api/auth/account",
            json={"password": PASSWORD},
        )
        assert response.status_code == 401
    finally:
        close_all_sessions()
        engine.dispose()
