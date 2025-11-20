from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class AuthPayload(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
def login(payload: AuthPayload):
    if not payload.username or not payload.password:
        raise HTTPException(status_code=400, detail="Missing credentials")
    return TokenResponse(access_token="dev-token", refresh_token="refresh-token")


@router.post("/signup", response_model=TokenResponse)
def signup(payload: AuthPayload):
    return TokenResponse(access_token="dev-token", refresh_token="refresh-token")


@router.post("/refresh", response_model=TokenResponse)
def refresh(refresh_token: str):
    if refresh_token != "refresh-token":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return TokenResponse(access_token="dev-token", refresh_token="refresh-token")
