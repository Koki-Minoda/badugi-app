# MGX Deployment Scripts

## mgx-prod-01.sh

Helper used on the `mgx-prod-01` VPS to deploy both the Vite frontend and the FastAPI backend.

### Usage

```bash
chmod +x scripts/deploy/mgx-prod-01.sh   # one-time
./scripts/deploy/mgx-prod-01.sh
```

### What it does

1. `cd ~/badugi-app` then `git pull origin main` (remote/branch can be overridden with `GIT_REMOTE` / `GIT_BRANCH` environment variables)
2. Recreate frontend dependencies with `npm ci`, build, and verify packaged ONNX assets
3. Install the backend project into the existing virtual environment
4. Restart the backend; startup applies Alembic migrations and fails closed unless the database reaches `head`
5. `rsync dist/ -> /var/www/mgx-poker`
6. Verify frontend asset hashes, production database health, ONNX WASM delivery, and authenticated P2P REST routing

> **Note:** The deploy user does not modify nginx configuration. Friend Match prefers WebSocket when the route is available and automatically falls back to the authenticated HTTPS REST transport when it is not. Deploy verification checks that the P2P REST endpoint reaches FastAPI and rejects an unauthenticated request.

## Production prerequisites

- Install `infra/systemd/mgx-backend.service.example` with the real service user and verify it with `systemd-analyze verify`.
- Install the HTTPS nginx template, validate it with `nginx -t`, and confirm the `/api/` and `/ws/` locations reach FastAPI.
- Keep the repository-root `.env` readable only by the service/deploy identity. Production requires a unique 32-or-more-character `SECRET_KEY`, a database password, and explicit HTTPS-only `CORS_ORIGINS`.
- Run `alembic current` and `alembic heads` before deploy. The application starts only after upgrading to the single committed head.

## Rollback boundary

`rollback_mgx_prod_01.sh` restores only a previously archived frontend `dist` tree. It does not roll back Git, Python packages, the backend process, or database migrations. Before every production deployment, operators must create and verify both frontend and database backups, record the deployed Git SHA and Alembic revision, and prepare a migration-specific downgrade or forward-fix. Never treat a frontend-only restore as a complete backend rollback.

After a rollback, validate nginx, restart the backend only when its code and schema are compatible, and rerun `/api/health`, the Friend Match REST/WebSocket smoke, tournament resume, hand replay, and Badugi AI telemetry checks.
