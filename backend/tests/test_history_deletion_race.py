"""Requests authenticated before DELETE must not resurrect private history."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from datetime import datetime, timezone
from threading import Event

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api import auth, badugi_actions, badugi_log, history
from app.core import account_writes
from app.core.security import get_password_hash
from app.dependencies.auth import get_current_user
from app.main import app
from app.models import Base, User, BadugiHandAction, HandLog, HandAction, HandResult, TournamentSnapshot, PlayFeedbackResult
from tests.test_tournament_state_api import sample_snapshot
from tests.test_analysis_chatgpt_api import sample_play_feedback
from tests.test_account_deletion import _setup_database, _signup_and_login, _auth, PASSWORD


CASES = [
    ('/api/history/hand', {'handId': 'late-private', 'data': {'private': True}}),
    ('/api/badugi/hands', {'hand_id': 'late-private', 'created_at': datetime.now(timezone.utc).isoformat(), 'actions': [], 'results': []}),
    ('/api/badugi/actions/batch', {'actions': [{'hand_id': 'late-private', 'player_id': 'hero', 'action': 'Call'}]}),
    ('/api/tournament/save', {'snapshot': sample_snapshot()}),
    ('/api/analysis/play-feedback', sample_play_feedback()),
]


@pytest.mark.parametrize('path,payload', CASES)
@pytest.mark.parametrize('recreate', [False, True])
def test_already_authenticated_request_cannot_write_after_deletion(monkeypatch, path, payload, recreate):
    engine, factory = _setup_database(monkeypatch)
    monkeypatch.setattr("app.api.analysis_chatgpt.get_play_feedback_advice", lambda _: {"adviceJa": "test", "adviceEn": "test"})
    from app.api.analysis_chatgpt import _feedback_rate_limit
    _feedback_rate_limit.clear()
    client = TestClient(app)
    history._reset_generic_history()
    badugi_log._reset_recent_logs()
    try:
        token = _signup_and_login(client, 'late-request@example.com')
        with factory() as session:
            old_identity = session.scalar(select(User))
            session.expunge(old_identity)
        assert client.request('DELETE', '/api/auth/account', headers=_auth(token), json={'password': PASSWORD}).status_code == 200
        if recreate:
            fresh = _signup_and_login(client, 'late-request@example.com')
            assert client.get('/api/auth/me', headers=_auth(fresh)).json()['id'] == old_identity.id
        # Simulate the dependency having completed before DELETE, not a new JWT check.
        app.dependency_overrides[get_current_user] = lambda: old_identity
        response = client.post(path, json=payload)
        assert response.status_code == 401
        assert response.json()['detail'] == 'account_no_longer_active'
        with factory() as session:
            for model in (HandLog, HandAction, HandResult, BadugiHandAction, TournamentSnapshot, PlayFeedbackResult):
                assert list(session.scalars(select(model))) == []
        assert not history._history_hands
        assert not badugi_log._recent_logs
    finally:
        app.dependency_overrides.clear()
        history._reset_generic_history()
        badugi_log._reset_recent_logs()
        engine.dispose()


def test_database_lock_orders_inflight_insert_before_deletion_without_local_lock(tmp_path, monkeypatch):
    """Separate connections must serialize even without shared process locks."""
    engine = create_engine(f'sqlite:///{tmp_path / "race.db"}', connect_args={'timeout': 5})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as session:
        user = User(email='race@example.com', hashed_password=get_password_hash(PASSWORD))
        session.add(user)
        session.commit()
        _ = user.id, user.hashed_password
        session.expunge(user)
    monkeypatch.setattr(account_writes, '_cache_locks', tuple(nullcontext() for _ in range(64)))
    locked, deleting, release, finished = Event(), Event(), Event(), Event()

    def insert():
        with factory() as session, account_writes.account_write(session, user):
            session.add(BadugiHandAction(owner_user_id=user.id, hand_id='inflight', player_id='hero', phase='BET', action='Call', action_type='call'))
            session.flush()
            locked.set()
            assert release.wait(5)
            session.commit()

    def delete():
        assert locked.wait(5)
        deleting.set()
        with factory() as session:
            auth._delete_account_data(auth.DeleteAccountRequest(password=PASSWORD), user, session)
        finished.set()

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            writer, deleter = pool.submit(insert), pool.submit(delete)
            assert deleting.wait(5)
            assert not finished.wait(0.1)
            release.set()
            writer.result(timeout=5)
            deleter.result(timeout=5)
        with factory() as session:
            assert session.get(User, user.id) is None
            assert list(session.scalars(select(BadugiHandAction))) == []
    finally:
        release.set()
        engine.dispose()


def test_recreated_identity_cannot_read_previous_process_cache(monkeypatch):
    engine, factory = _setup_database(monkeypatch)
    client = TestClient(app)
    history._reset_generic_history()
    badugi_log._reset_recent_logs()
    try:
        token = _signup_and_login(client, 'cached@example.com')
        for path, payload in CASES[:2]:
            assert client.post(path, headers=_auth(token), json=payload).status_code == 200
        cached_history = history._history_hands.copy()
        cached_recent = list(badugi_log._recent_logs)
        assert client.request('DELETE', '/api/auth/account', headers=_auth(token), json={'password': PASSWORD}).status_code == 200
        # A different worker may still retain its bounded fallback cache.
        history._history_hands.update(cached_history)
        badugi_log._recent_logs.extend(cached_recent)
        fresh = _signup_and_login(client, 'cached@example.com')
        for path in ('/api/history/hand', '/api/badugi/hands/recent'):
            assert client.get(path, headers=_auth(fresh)).json()['items'] == []
        assert client.get('/api/history/hand/late-private', headers=_auth(fresh)).status_code == 404
    finally:
        history._reset_generic_history()
        badugi_log._reset_recent_logs()
        engine.dispose()
