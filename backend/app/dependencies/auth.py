"""Minimal auth dependency placeholder.

This will be replaced by the full Task 1 Auth implementation once available.
For now we map bearer tokens to simple User rows so per-user APIs can function.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_TOKEN_TO_USERNAME = {
    "demo-token": "demo",
    "demo-refresh": "demo",
}


def _username_from_token(token: str) -> str:
    token = (token or "").strip()
    if not token:
        return ""
    return _TOKEN_TO_USERNAME.get(token, token)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    username = _username_from_token(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user = db.query(User).filter(User.name == username).one_or_none()
    if user:
        return user
    user = User(name=username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

