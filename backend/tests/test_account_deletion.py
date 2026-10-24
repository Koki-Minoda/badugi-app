import pytest
from sqlalchemy.exc import SQLAlchemyError
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


def test_deleted_token_cannot_authenticate_reused_user_id_or_websocket(monkeypatch):
    import pytest
    from starlette.websockets import WebSocketDisconnect
    engine, _ = _setup_database(monkeypatch)
    client = TestClient(app)
    try:
        old = _signup_and_login(client, 'reused@example.com')
        old_id = client.get('/api/auth/me', headers=_auth(old)).json()['id']
        assert client.request('DELETE', '/api/auth/account', headers=_auth(old), json={'password': PASSWORD}).status_code == 200
        # Same email and password, and SQLite reuses the deleted highest row ID.
        fresh = _signup_and_login(client, 'reused@example.com')
        assert client.get('/api/auth/me', headers=_auth(fresh)).json()['id'] == old_id
        assert client.get('/api/auth/me', headers=_auth(old)).status_code == 401
        room = client.post('/api/p2p/rooms', headers=_auth(fresh), json={'variantId': 'badugi'}).json()['roomCode']
        with client.websocket_connect(f'/ws/p2p/{room}', subprotocols=['mgx-auth', old]) as ws:
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_json()
            assert closed.value.code == 4401
        with client.websocket_connect(f'/ws/p2p/{room}', subprotocols=['mgx-auth', fresh]) as ws:
            assert ws.receive_json()['event'] == 'state'
    finally:
        p2p_room_manager.reset()
        app.dependency_overrides.clear()
        close_all_sessions()
        engine.dispose()


@pytest.mark.parametrize('outcome', ['success', 'wrong-password', 'commit-failure'])
def test_account_deletion_removes_only_owned_history_and_caches(monkeypatch, outcome):
    from datetime import datetime, timezone
    from app.api import history, badugi_log
    from app.models import HandLog, HandAction, HandResult, BadugiHandAction
    engine, factory = _setup_database(monkeypatch)
    history._reset_generic_history()
    badugi_log._reset_recent_logs()
    client = TestClient(app)
    try:
        other = _signup_and_login(client, 'other-history@example.com')
        owner = _signup_and_login(client, 'owner-history@example.com')
        owner_id = client.get('/api/auth/me', headers=_auth(owner)).json()['id']
        for token, hand in [(other, 'other-owned'), (owner, 'delete-owned')]:
            assert client.post('/api/history/hand', headers=_auth(token), json={'handId':hand,'data':{'private':'test'}}).status_code == 200
            assert client.post('/api/badugi/hands', headers=_auth(token), json={
                'hand_id':hand,'created_at':datetime.now(timezone.utc).isoformat(),
                'actions':[{'seat_index':0,'action':'Call','amount':10,'round':0,'phase':'BET'}],
                'results':[{'seat_index':0,'final_stack':100,'is_winner':True,'pot_share':20}],
            }).status_code == 200
            assert client.post('/api/badugi/actions/batch', headers=_auth(token), json={
                'actions':[{'hand_id':hand,'player_id':'hero','phase':'BET','round':0,'action':'Call','paid':10}],
            }).status_code == 200
        with factory() as session:
            legacy = HandLog(hand_id='legacy-unowned',metadata_json={'_owner_user_id':owner_id})
            legacy.actions.append(HandAction(seat_index=0,action='Call',amount=10,round=0,phase='BET'))
            legacy.results.append(HandResult(seat_index=0,final_stack=100,is_winner=True,pot_share=20))
            session.add(legacy)
            session.add(BadugiHandAction(hand_id='legacy-unowned',player_id='hero',phase='BET',round=0,action='Call',action_type='call',metadata_json={'_owner_user_id':owner_id}))
            session.commit()
        assert client.get('/api/badugi/hands/legacy-unowned',headers=_auth(owner)).status_code==404
        if outcome == 'commit-failure':
            def fail_commit(_):
                raise SQLAlchemyError('injected commit failure')
            monkeypatch.setattr(factory.class_, 'commit', fail_commit)
        response=client.request('DELETE','/api/auth/account',headers=_auth(owner),json={'password':'wrong' if outcome=='wrong-password' else PASSWORD})
        assert response.status_code == {'success':200,'wrong-password':403,'commit-failure':503}[outcome]
        with factory() as session:
            hands=set(session.scalars(select(HandLog.hand_id)))
            assert hands == ({'other-owned','legacy-unowned'} if outcome=='success' else {'other-owned','delete-owned','legacy-unowned'})
            for model in [HandAction, HandResult, BadugiHandAction]:
                assert len(list(session.scalars(select(model)))) == (2 if outcome=='success' else 3)
        assert any(key[1]=='other-owned' for key in history._history_hands)
        assert any(payload.hand_id=='other-owned' for _,payload in badugi_log._recent_logs)
        assert any(key[0]==owner_id for key in history._history_hands) == (outcome!='success')
        assert any(user_id==owner_id for user_id,_ in badugi_log._recent_logs) == (outcome!='success')
        assert client.get('/api/badugi/hands/other-owned',headers=_auth(other)).status_code == 200
        if outcome=='success':
            fresh=_signup_and_login(client,'owner-history@example.com')
            assert client.get('/api/auth/me',headers=_auth(fresh)).json()['id']==owner_id
            assert client.get('/api/history/hand/delete-owned',headers=_auth(fresh)).status_code==404
            assert client.get('/api/badugi/hands/delete-owned',headers=_auth(fresh)).status_code==404
            assert client.get('/api/badugi/stats?player_id=hero',headers=_auth(fresh)).json()['hands']==0
    finally:
        history._reset_generic_history()
        badugi_log._reset_recent_logs()
        app.dependency_overrides.clear()
        close_all_sessions()
        engine.dispose()
