from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer

from server.routers import (
  profile,
  history,
  tournament,
  tasks,
  ai_models,
  auth,
  rating,
  rooms,
)
from server.p2p_sync import websocket_endpoint

app = FastAPI(title="Badugi App API", version="0.1.0", docs_url="/api/docs")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
  if token not in {"demo-token", "demo-refresh"}:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
  return "demo"


@app.get("/api/health")
def health():
  return {"status": "ok"}


@app.get("/api/status")
def app_status(user: str = Depends(get_current_user)):
  return {"status": "ok", "data": {"user": user, "status": "ready"}}


@app.middleware("http")
async def add_p3p_header(request, call_next):
  response: Response = await call_next(request)
  response.headers["X-P3P"] = "CP=\"This is not a P3P policy\""
  return response


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(rating.router, prefix="/api/rating", tags=["rating"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(tournament.router, prefix="/api/tournament", tags=["tournament"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(ai_models.router, prefix="/api/ai", tags=["ai"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])

app.add_api_websocket_route("/ws/room/{room_id}/play", websocket_endpoint)
