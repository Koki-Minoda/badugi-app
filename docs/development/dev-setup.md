# Dev Setup (FE + Backend)

This repo contains a Vite frontend and a FastAPI backend in `backend/`. The Vite dev server proxies `/api/*` to the backend when running locally.

## 1) Start the backend (FastAPI)

From repo root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[test]
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend requirements and environment variables are documented in `backend/README.md`.

## 2) Start the frontend (Vite)

From repo root:

```bash
npm install
npm run dev
```

## 3) Verify the proxy works

The Vite dev server should forward `/api/*` to `http://127.0.0.1:8000`.

```bash
curl -i http://127.0.0.1:5173/api/health
curl -i http://127.0.0.1:5173/api/badugi/hands/recent
```

## 4) Verify auth flow (signup -> login -> auth/me)

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

TOKEN="<paste access_token from login response>"
TOKEN_TYPE="Bearer"
curl -s http://127.0.0.1:8000/api/auth/me \
  -H "Authorization: ${TOKEN_TYPE} ${TOKEN}"
```

## 5) Smoke-test checklist (UI)

- Start backend and frontend.
- Open the app, sign up and log in via the UI.
- Confirm the app proceeds past the auth gate (auth/me succeeds).
- Trigger a hand to ensure syncManager posts (check browser devtools Network for `/api/badugi/hands` with `Authorization: Bearer <token>` header).
- Confirm seat HUD stats (VPIP/PFR/AF/Hands) render for active seats.
- In a narrow viewport (<=360px), confirm cards/chips/controls remain visible without overlap.

## Routes used by the frontend

Frontend calls these routes via `/api/*`:

- `/api/auth/signup`
- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/badugi/hands`
- `/api/badugi/hands/recent`
- `/api/tournament/save`

The backend in `backend/` defines these routes. It returns `access_token` for `/api/auth/login` and expects `Authorization: Bearer <token>` for authenticated routes.
