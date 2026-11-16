# MGX

MGX is ENISHI-LAB's mixed-game poker learning platform. The v1 roadmap focuses on ten Core Games, a consistent Play experience, and coaching whose evidence and limits can be explained. Existing game and AI research assets remain available; adding games and completing every RL difficulty are post-v1 work.

## Source of truth

- Product repository: `Koki-Minoda/badugi-app`
- Release branch: `main`
- Production frontend: React 19 + Vite
- Production API: FastAPI under `backend/app`

Release decisions must follow `docs/bugs/RELEASE_GATES.md`. A green build alone is not Friend Alpha GO; physical-device and live-head evidence are mandatory.

## v1 completion

Task status and completion evidence are tracked in [roadmap #123](https://github.com/Koki-Minoda/badugi-app/issues/123).
The [v1 release contract](docs/release/MGX_V1_RELEASE_CONTRACT.md) defines Core scope and the eight gates.
See the [Design Constitution and Play comparison](docs/design/MGX_DESIGN_CONSTITUTION.md),
[Coach quality contract](docs/release/MGX_V1_COACH_QUALITY.md), and
[2026-11-02 execution evidence](docs/release/MGX_V1_EXECUTION_20261102.md).
Generated reports certify only their stated scope; browser emulation, sampled engine hands, and CPU inference do not replace physical QA or strategy validation.

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
Set `VITE_MGX_REMOTE_DEV=1` only when serving the remote `/dev/` preview that
requires the `wss://mgx-poker.com` HMR endpoint.

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
