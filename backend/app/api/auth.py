import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from ..core.db import get_db
from ..dependencies.auth import get_current_user
from ..models import PlayFeedbackResult, TournamentSnapshot, User
from ..schemas.user import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=1024)


# NOTE: /auth/signup returns a minimal acknowledgement payload so the client
# can decide whether to auto-login or force a separate login flow.
@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=email,
        hashed_password=get_password_hash(payload.password),
        name=email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}


# NOTE: /auth/login only issues the JWT. The frontend calls /auth/me
# immediately afterwards to hydrate the current user profile.
@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(days=7)
    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserPublic)
def read_current_user(current_user: User = Depends(get_current_user)):
    return UserPublic(
        id=current_user.id,
        username=current_user.name or current_user.email,
        created_at=current_user.created_at,
    )


@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    return {"ok": True}


@router.delete("/account")
async def delete_account(
    payload: DeleteAccountRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the authenticated account and linked private data."""

    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="invalid_password",
            headers={
                "Cache-Control": "private, no-store",
                "Pragma": "no-cache",
            },
        )

    user_id = current_user.id
    try:
        db.execute(
            delete(TournamentSnapshot).where(TournamentSnapshot.user_id == user_id),
        )
        # Feedback payloads are removed instead of anonymized because they can
        # contain user-provided hand context even when the top-level flag says
        # PII was stripped.
        db.execute(
            delete(PlayFeedbackResult).where(PlayFeedbackResult.user_id == user_id),
        )
        db.delete(current_user)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="account_deletion_failed",
        ) from exc

    # Import lazily to avoid coupling authentication module initialization to
    # the P2P router. The database deletion remains authoritative even if no
    # process-local room exists.
    from .p2p import terminate_user_p2p_sessions

    try:
        await terminate_user_p2p_sessions(str(user_id))
    except Exception:
        # The account and private persisted data are already deleted. A stale
        # process-local room must not turn a successful permanent deletion into
        # a misleading error response.
        logger.exception("Failed to terminate P2P state for deleted user %s", user_id)
    return {"deleted": True}
