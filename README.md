# MGX

MGX is ENISHI-LAB's multi-variant poker application and evaluation platform. It includes Badugi and other draw, board, stud, mixed, and Chinese poker variants, plus CPU policies, ONNX models, reinforcement-learning tooling, telemetry, and release gates.

## Source of truth

- Product repository: `Koki-Minoda/badugi-app`
- Release branch after the roadmap 0–6 integration: `main`
- Production frontend: React 19 + Vite
- Production API: FastAPI under `backend/app`

Release decisions must follow `docs/bugs/RELEASE_GATES.md`. A green build alone is not Friend Alpha GO; physical-device and live-head evidence are mandatory.

## Local setup

Frontend (Node.js 22 recommended):

```bash
npm ci --legacy-peer-deps
npm run dev -- --host 127.0.0.1 --port 3000
```

Backend (Python 3.11 recommended):

```bash
python -m venv backend/.venv
backend/.venv/bin/pip install -e './backend[test]'
BACKEND_ENV=local BACKEND_DB_DRIVER=sqlite BACKEND_DB_NAME=mgx-local.db \
  SECRET_KEY=local-development-only \
  backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Vite proxies `/api` and `/ws` to the local backend on port 8000.

## Required checks

```bash
npm run lint
npm run build
npm run test:tier1
npm run test:mgx:safety
npm audit
python -m pytest backend/tests
```

The deployment workflow runs frontend and backend checks before SSH deployment. Pull requests never execute the deployment job.

## Architecture map

- `src/`: frontend product, game engines/controllers, CPU/AI policies, UI, and local QA harnesses.
- `backend/app/`: canonical production API and persistence service.
- `src/server/`: specialized friend-match/WebSocket test and development service.
- `server/`: legacy prototype server; do not treat it as the production backend.
- `tests/` and `e2e/`: browser and regression gates.
- `docs/`: architecture, release, QA, AI, and deployment evidence.
- `scripts/deploy/`: production deployment and health verification.

The Badugi controller paths and the large `src/ui/App.jsx` are still intentionally dual-wired. Their unification requires a dedicated regression project and is not part of release hardening.
