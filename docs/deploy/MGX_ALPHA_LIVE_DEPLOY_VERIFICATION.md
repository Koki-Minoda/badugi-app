# MGX Alpha Live Deploy Verification

Date: 2026-05-17

## Live Source Of Truth

| Item | Value |
| --- | --- |
| Live URL | `https://mgx-poker.com/` |
| Health endpoint | `https://mgx-poker.com/api/health` |
| Verification report | `reports/alpha/live-deploy-verification.json` |
| Live layout evidence | `reports/alpha/live-core5-layout-evidence-v2.json` |
| Live tournament fatal report | `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| Live Badugi betting closure report | `reports/alpha/live-badugi-betting-closure.json` |

## Latest Verified Snapshot

| Field | Result |
| --- | --- |
| localHead | `72dbc24b1ae4d271bbde81cb3bb41d3d550203ab` |
| deployedCommit | `72dbc24b1ae4d271bbde81cb3bb41d3d550203ab` |
| deployedBundle | `/assets/index-DSSr19I_.js` |
| matched | `true` |
| health | `PASS` |
| buildTime | `2026-05-16T17:57:58.946Z` |

## Live Blocker Evidence

The live deploy snapshot matches local `72dbc24`, but D01/D02/S01/S02 tournament smoke reproduced a browser fatal:

```txt
TypeError: applyPlayerAction is not a function
```

Classification:

| ID | Priority | Status | Evidence |
| --- | --- | --- | --- |
| `CORE5-UI-LIVE-001` | P0 | REPRODUCED_LIVE | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts`; `reports/alpha/live-core5-tournament-runtime-fatal.json` |

## Required Follow-up

Fix the tournament forced-action/controller integration for non-Badugi Core5 variants, deploy a new committed head, verify `window.__MGX_BUILD_INFO__`, and rerun:

```bash
npx playwright test tests/e2e/live-deploy-verification.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-alpha-smoke.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-badugi-betting-closure.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
```
