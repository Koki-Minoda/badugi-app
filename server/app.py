from datetime import datetime, timezone
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.middleware.rate_limit import RateLimiterMiddleware
from server.routers import profile, history, tournament, tasks, ai_models, sync, auth

app = FastAPI(nickname="badugi-core")
app.add_middleware(RateLimiterMiddleware, max_requests=60, window_seconds=60)
allowed_origins = os.getenv(
    "MGX_ALLOWED_ORIGINS",
    "https://mgx-poker.com,http://127.0.0.1:3000,http://localhost:3000",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(history.router)
app.include_router(tournament.router)
app.include_router(tasks.router)
app.include_router(ai_models.router)
app.include_router(sync.router)
app.include_router(auth.router, prefix="/api/auth")

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/health", tags=["health"])
async def health_check_api():
    return await health_check()
