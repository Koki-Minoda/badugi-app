from datetime import datetime, timezone
import os
import secrets
import uuid

from fastapi import APIRouter, Header, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from server.data_store import store

router = APIRouter(tags=["auth"])
_bcrypt_rounds = int(os.getenv("MGX_BCRYPT_ROUNDS", "12"))
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=_bcrypt_rounds,
)


class SignupPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    confirmPassword: str = Field(min_length=6)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserResponse(BaseModel):
    id: str
    email: EmailStr


class AuthResponse(BaseModel):
    isAuthenticated: bool
    user: UserResponse
    apiKey: str


def _issue_api_key(user_id: str) -> str:
    api_key = secrets.token_urlsafe(24)
    store.register_api_key(api_key, user_id)
    return api_key


def _sanitize_user(user: dict) -> UserResponse:
    return UserResponse(id=user["id"], email=user["email"])


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupPayload):
    email = payload.email.strip().lower()
    if payload.password != payload.confirmPassword:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
    existing = store.get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    password_hash = pwd_context.hash(payload.password)
    user_id = str(uuid.uuid4())
    user = store.create_user(user_id, email, password_hash)
    api_key = _issue_api_key(user_id)
    return AuthResponse(isAuthenticated=True, user=_sanitize_user(user), apiKey=api_key)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginPayload):
    email = payload.email.strip().lower()
    user = store.get_user_by_email(email)
    if not user or not pwd_context.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    api_key = _issue_api_key(user["id"])
    return AuthResponse(isAuthenticated=True, user=_sanitize_user(user), apiKey=api_key)


@router.get("/me", response_model=UserResponse)
def me(
    x_api_key: str = Header(None, alias="x-api-key"),
    authorization: str = Header(None),
):
    candidate = x_api_key
    if not candidate and authorization and authorization.lower().startswith("bearer "):
        candidate = authorization.split(" ", 1)[1].strip()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    user_id = store.resolve_user_id_for_api_key(candidate)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user = store.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return _sanitize_user(user)


@router.post("/logout")
def logout(
    x_api_key: str = Header(None, alias="x-api-key"),
    authorization: str = Header(None),
):
    candidate = x_api_key
    if not candidate and authorization and authorization.lower().startswith("bearer "):
        candidate = authorization.split(" ", 1)[1].strip()
    if candidate:
        store.revoke_api_key(candidate)
    return {"ok": True, "timestamp": datetime.now(timezone.utc).isoformat()}
