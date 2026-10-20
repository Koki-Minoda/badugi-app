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
4. Start one backend worker to apply/verify migrations, then switch to two workers with automatic override rollback on failure
5. `rsync dist/ -> /var/www/mgx-poker` and remove stale nested `/dev/assets`
6. Add the `/ws/` proxy to the active MGX site only when missing, with a timestamped backup and automatic rollback if `nginx -t` rejects it
7. Verify frontend asset hashes, production database health, ONNX WASM delivery, authenticated P2P REST routing, and the WSS handshake

> **Note:** nginx changes are restricted to `/etc/nginx/sites-enabled/mgx-poker.com`. Existing `/ws/` configuration is left unchanged; an inserted managed block is backed up under `/var/backups/mgx-nginx/`. The deploy identity needs passwordless `sudo -n` only for the documented nginx and systemd operations.

## Production prerequisites

- Install `infra/systemd/mgx-backend.service.example` with the real service user and verify it with `systemd-analyze verify`.
- Install the HTTPS nginx template, validate it with `nginx -t`, and confirm the `/api/` and `/ws/` locations reach FastAPI.
- Keep the repository-root `.env` readable only by the service/deploy identity. Production requires a unique 32-or-more-character `SECRET_KEY`, a database password, and explicit HTTPS-only `CORS_ORIGINS`.
- Run `alembic current` and `alembic heads` before deploy. The application starts only after upgrading to the single committed head.

## Rollback boundary

`rollback_mgx_prod_01.sh` restores only a previously archived frontend `dist` tree. It does not roll back Git, Python packages, the backend process, or database migrations. Before every production deployment, operators must create and verify both frontend and database backups, record the deployed Git SHA and Alembic revision, and prepare a migration-specific downgrade or forward-fix. Never treat a frontend-only restore as a complete backend rollback.

After a rollback, validate nginx, restart the backend only when its code and schema are compatible, and rerun `/api/health`, the Friend Match REST/WebSocket smoke, tournament resume, hand replay, and Badugi AI telemetry checks.

## Public release verification

`node scripts/deploy/verify-public-release.mjs --source-commit "$(git rev-parse HEAD)"`
checks the actual public release metadata, HTML, entry JS/CSS, deep links, all
local opponent PNGs and production API/database health. `--expected-commit <full SHA>`
can additionally pin a specific deployed release. The report is always written to
`reports/production-release/audit.json`, including failures; override with `--report`.

The production nightly runs this before browser tests and uploads the report with
its portrait screenshots. `publishedCommit` records the website actually tested;
`sourceCommit` records the test checkout. A test/evidence/documentation-only commit
may differ from the published SHA. Application, dependency, asset and unknown file
changes fail the check until published. Full Git history is required: an unknown
published SHA or a deployed commit outside the source ancestry fails closed.
This comparison detects unshipped source changes; it does not independently attest
the server's backend Git tree. Backend deployment identity remains part of the
existing deployment checks.

`E2E_APP_URL=https://mgx-poker.com/ npx playwright test --config playwright.portraits.config.js`
checks five decoded, visible opponent images in NLH, 2-7 TD and Badugi on desktop
Chromium and iPhone WebKit emulation. It uses only temporary QA accounts and removes
them afterward. Run without `E2E_APP_URL` for the local dev server and a test backend.
These are browser-emulation checks, not physical-device or independent human QM approval.
