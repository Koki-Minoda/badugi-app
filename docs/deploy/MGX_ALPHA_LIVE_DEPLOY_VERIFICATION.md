# MGX Alpha Live Deploy Verification

Date: 2026-05-18

## Live Source Of Truth

| Item | Value |
| --- | --- |
| Live URL | `https://mgx-poker.com/` |
| Health endpoint | `https://mgx-poker.com/api/health` |
| Verification report | `reports/alpha/live-deploy-verification-after-cross-variant-reset.json` |
| Live layout evidence | `reports/alpha/live-core5-layout-evidence-v2.json` |
| Live tournament fatal report | `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| Live Badugi betting closure report | `reports/alpha/live-badugi-betting-closure.json` |
| Live browser gameplay smoke | `reports/browser-gameplay/live-core5-smoke-summary.json` |
| Live browser desktop matrix | `reports/browser-gameplay/live-core5-desktop-20hand-summary.json` |
| Live browser mobile matrix | `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |

## Latest Verified Snapshot

| Field | Result |
| --- | --- |
| localHead | `77265c4bc7718085cc7d9d686f481ec77f66ffbd` |
| deployedCommit | `77265c4bc7718085cc7d9d686f481ec77f66ffbd` |
| deployedBundle | `/assets/index-CzoXsOzq.js` |
| matched | `true` |
| health | `PASS` |
| buildTime | `2026-05-18T13:54:42.923Z` |

## Live Blocker Evidence

The live deploy snapshot now matches local head `77265c4bc7718085cc7d9d686f481ec77f66ffbd` in `reports/alpha/live-deploy-verification-after-cross-variant-reset.json`. The deployed build includes the cross-variant session reset commits (`17c6d16`, `e2a3f96`) plus the later live CPU DB audit docs. `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}`.

```txt
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
# 5 passed
```

Classification:

| ID | Priority | Status | Evidence |
| --- | --- | --- | --- |
| `CORE5-UI-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts`; `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| `CORE5-TOUR-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-browser-gameplay-invariant.spec.ts`; `reports/browser-gameplay/live-core5-smoke-summary.json`; `reports/browser-gameplay/live-core5-desktop-20hand-summary.json`; `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |

The post-deploy focused Badugi re-raise-positive proof passed live. The post-deploy Core5 live smoke completed 24/30 variant/mode/viewport cases; every case that reached gameplay passed, while 6 Triple Draw cases were blocked before launch by live `/auth/signup` 504 responses. Treat those 6 rows as `LIVE_AUTH_GATEWAY_TIMEOUT`, not as gameplay invariant failures, and rerun once the live auth path is stable.

The cross-variant contamination recheck now passes live:

```txt
LIVE_PREVIEW=1 npx playwright test tests/e2e/cross-variant-session-contamination.spec.ts --project=badugi-flow
# 4 passed
```

The remaining live Badugi tournament mobile blocker is not stale D01/D02 controller reuse. The 20-hand live mobile Badugi tournament matrix fails in both portrait and landscape at DRAW1 CPU action application with `controller action returned no snapshot`; track this as `BADUGI-DRAW1-CPU-ACTION-001`.

Live layout evidence now passes:

```txt
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
# 30 passed
```

## Required Follow-up

Remote sync and physical mobile QA remain required before friend alpha GO. After any new fix, verify `window.__MGX_BUILD_INFO__` and rerun:

```bash
npx playwright test tests/e2e/live-deploy-verification.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-browser-gameplay-invariant.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-badugi-betting-closure.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
```
