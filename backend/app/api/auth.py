from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from ..core.db import get_db
from ..dependencies.auth import get_current_user
from ..models import User
from ..schemas.user import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
