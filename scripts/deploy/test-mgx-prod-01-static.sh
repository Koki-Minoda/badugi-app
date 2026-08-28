#!/usr/bin/env bash
set -euo pipefail

script="scripts/deploy/mgx-prod-01.sh"
bash -n "$script"

# shellcheck disable=SC2016
migration_line="$(grep -n 'run_backend_migrations "\$BACKEND_ENV_FILE"' "$script" | cut -d: -f1)"
restart_line="$(grep -n 'systemctl restart mgx-backend.service' "$script" | cut -d: -f1)"
test -n "$migration_line"
test -n "$restart_line"
test "$migration_line" -lt "$restart_line"
# shellcheck disable=SC2016
grep -q 'BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/etc/mgx/mgx-backend.env}"' "$script"
grep -q 'scripts/deploy/run-with-dotenv.py' "$script"
# shellcheck disable=SC2016
grep -q '"\$env_file" "\$alembic_bin" upgrade head' "$script"
# shellcheck disable=SC2016
grep -q 'sudo -n -- "\$python_bin"' "$script"
if grep -q 'source .*BACKEND_ENV_FILE' "$script"; then
  echo "backend environment file must not be evaluated as shell code" >&2
  exit 1
fi
grep -q 'verify_live_frontend' "$script"
grep -q 'verify_live_p2p_rest_route' "$script"

echo "deploy static safety: PASS"
