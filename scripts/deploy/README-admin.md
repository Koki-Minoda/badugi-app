# MGX production deployment administrator setup

On 2026-10-05 all 14 deployment validation jobs passed, but deployment run
37274577919 stopped at worker configuration: the `mgx` account's passwordless
sudo rules allow restarting the backend and publishing only from
`/home/mgx/badugi-app/dist/`. They do not allow writing systemd overrides or
publishing directly from a temporary build directory.

The revised deployment keeps builds in a fresh user-owned snapshot, stages
the finished output at the already-authorized fixed path, and calls a fixed
root-owned helper for worker configuration and the managed nginx WebSocket
location. A readiness check runs before pulling code or installing packages.

## One-time administrator action

Review these four files together, then run the installer with sudo on the VPS:

- `install-mgx-prod-admin.sh`
- `mgx-prod-admin.py`
- `configure-mgx-backend-workers.sh`
- `ensure_mgx_nginx_websocket_proxy.sh`

The installer verifies private staged copies against pinned SHA-256 hashes.
It installs the two scripts under `/usr/local/libexec/mgx-deploy/`, the helper
as `/usr/local/sbin/mgx-prod-admin`, and a dedicated sudoers file allowing only
the exact `check`, `workers`, and `nginx-ws` arguments. Existing files are
backed up under `/var/backups/mgx-deploy-admin/`. The installer validates sudoers
and rolls back its sudoers change if global validation fails.

The setup itself does not restart services. The subsequent deployment retains
the one-worker migration/health preflight, then restores two workers and checks
health before publishing the frontend. nginx changes retain their original
configuration validation and rollback. The optional WASM MIME provisioning
continues to use the existing browser ArrayBuffer fallback when not permitted.

## Privilege boundary

The privileged helper accepts no paths, shell commands, environment overrides,
or additional arguments. It clears the inherited environment, verifies
root-only ownership/write permissions and exact source hashes, and refuses to
operate if the backend service would run repository code as root. Python runs
in isolated mode. The helper never runs npm, pip, or repository-owned scripts
as root; only the installed, pinned copies are used.

Changing either privileged script requires a reviewed hash update and another
administrator installation. Do not replace this with an unrestricted
passwordless sudo rule or grant writes of caller-supplied systemd/nginx files.

Verification: `npm run test:deploy:static` runs helper security regressions and
deployment ordering checks; `npm run test:deploy:nginx-ws` tests the actual nginx
transformation, idempotence, invalid input rejection, and rollback with mocks.
