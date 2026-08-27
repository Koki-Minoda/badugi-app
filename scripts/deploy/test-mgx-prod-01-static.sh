#!/usr/bin/env bash
set -euo pipefail

script="scripts/deploy/mgx-prod-01.sh"
bash -n "$script"

migration_line="$(grep -n 'alembic upgrade head' "$script" | cut -d: -f1)"
restart_line="$(grep -n 'systemctl restart mgx-backend.service' "$script" | cut -d: -f1)"
test -n "$migration_line"
test -n "$restart_line"
test "$migration_line" -lt "$restart_line"
grep -q 'verify_live_frontend' "$script"
grep -q 'verify_live_p2p_rest_route' "$script"

echo "deploy static safety: PASS"
