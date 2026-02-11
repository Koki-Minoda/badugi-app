from fastapi import Header, HTTPException, status
from typing import Optional

from server.data_store import store

API_KEY = "spec21-secret-token"

def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


async def require_api_key(
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
    authorization: Optional[str] = Header(None),
):
    candidate = x_api_key or _extract_bearer_token(authorization)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing API key")
    if candidate == API_KEY:
        return candidate
    if store.resolve_user_id_for_api_key(candidate):
        return candidate
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
