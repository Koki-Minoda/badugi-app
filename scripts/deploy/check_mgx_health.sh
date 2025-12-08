#!/usr/bin/env bash
# Basic deployment smoke test (remember to `chmod +x scripts/deploy/check_mgx_health.sh`).
set -euo pipefail

BASE_URL="${1:-http://localhost}"
echo "[health-check] using base URL: ${BASE_URL}"

HEALTH_ENDPOINTS=("/healthz" "/api/health")
health_ok=false
for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
  url="${BASE_URL%/}${endpoint}"
  echo "[health-check] probing ${url}"
  if curl -fsS "$url" >/dev/null; then
    echo "[health-check] backend healthy via ${endpoint}"
    health_ok=true
    break
  fi
done

if [ "$health_ok" != "true" ]; then
  echo "[health-check] backend health probe failed" >&2
  exit 1
fi

echo "[health-check] verifying frontend HTML at ${BASE_URL}/"
homepage=$(curl -fsS "${BASE_URL%/}/")
if ! printf "%s" "$homepage" | grep -iq "<html"; then
  echo "[health-check] frontend response does not look like HTML" >&2
  exit 1
fi

echo "[health-check] success"
