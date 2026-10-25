"""Serialize authenticated writes with deletion, including already-authenticated requests."""
from contextlib import contextmanager
from threading import RLock

from fastapi import HTTPException
from sqlalchemy import update

from ..models import User

# Bounded process-local locks protect cache publication/purge. The SQL write
# lock is authoritative across processes and works on both MySQL and SQLite.
_cache_locks = tuple(RLock() for _ in range(64))


@contextmanager
def account_write(session, user):
    with _cache_locks[user.id % len(_cache_locks)]:
        try:
            result = session.execute(
                update(User).where(
                    User.id == user.id,
                    User.hashed_password == user.hashed_password,
                ).values(id=User.id, updated_at=User.updated_at)
                .execution_options(synchronize_session=False)
            )
            # SQLAlchemy MySQL uses matched-row counts for no-op updates.
            # A password hash also distinguishes a recreated SQLite identity.
            if result.rowcount != 1:
                raise HTTPException(status_code=401, detail="account_no_longer_active")
            yield
        except Exception:
            session.rollback()
            raise
