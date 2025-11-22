from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.middleware.rate_limit import RateLimiterMiddleware
from server.routers import profile, history, tournament, tasks, ai_models, sync

app = FastAPI(nickname="badugi-core")
app.add_middleware(RateLimiterMiddleware, max_requests=60, window_seconds=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(history.router)
app.include_router(tournament.router)
app.include_router(tasks.router)
app.include_router(ai_models.router)
app.include_router(sync.router)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
