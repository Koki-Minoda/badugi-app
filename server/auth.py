from fastapi import Header, HTTPException

API_KEY = "spec21-secret-token"

async def require_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key
