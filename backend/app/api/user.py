import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from ..core import db
from ..core.db import check_db_connection
from ..dependencies.auth import get_current_user
from ..models import User

router = APIRouter()


def _is_admin_user(current_user: User) -> bool:
    # Temporary admin authorization strategy:
    # User model has no admin flag yet, so we gate /api/users via MGX_ADMIN_USERNAMES.
    # Allowed identities are matched against current_user.name and current_user.email.
    allowlist_raw = os.getenv("MGX_ADMIN_USERNAMES", "")
    allowlist = {item.strip().lower() for item in allowlist_raw.split(",") if item.strip()}
    principal = (
        getattr(current_user, "username", None)
        or getattr(current_user, "name", None)
        or getattr(current_user, "email", None)
        or ""
    ).strip().lower()
    return bool(allowlist) and principal in allowlist


@router.get("/users")
def list_users(current_user: User = Depends(get_current_user)):
    """Return all users if the database is reachable; otherwise, an empty list."""

    if not _is_admin_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin_required",
        )

    if not check_db_connection():
        return {"items": []}

    session = db.SessionLocal()
    try:
        users = session.query(User).all()
    except SQLAlchemyError:
        return {"items": []}
    finally:
        session.close()

    return {"items": [user.to_dict() for user in users]}
