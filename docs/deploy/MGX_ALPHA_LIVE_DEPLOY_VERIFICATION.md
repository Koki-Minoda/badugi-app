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
| localHead | see `reports/alpha/live-deploy-verification.json` |
| deployedCommit | see `reports/alpha/live-deploy-verification.json` |
| deployedBundle | see `reports/alpha/live-deploy-verification.json` |
| matched | `true` |
| health | `PASS` |
| buildTime | see `reports/alpha/live-deploy-verification.json` |

## Live Blocker Evidence

The live deploy snapshot now matches the local head recorded in `reports/alpha/live-deploy-verification.json`. The original D01/D02/S01/S02 tournament browser fatal has been fixed and the live fatal guard passes for all Core5 games.

```txt
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
# 5 passed
```

Classification:

| ID | Priority | Status | Evidence |
| --- | --- | --- | --- |
| `CORE5-UI-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts`; `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| `CORE5-TOUR-LIVE-001` | P0 | REPRODUCED_LIVE | `tests/e2e/live-core5-alpha-smoke.spec.ts`; `reports/alpha/live-core5-alpha-smoke.json` |

The remaining live blocker is not a browser fatal. Live Core5 smoke still fails the tournament result path: D01/D02/S01/S02 tournament starts and actions can be applied, but result/next-hand is not reached inside the smoke budget. Badugi also showed a final `BET` state where controller metadata had `nextTurn: null` but top-level `turn` remained set, so the smoke could not progress.

Live layout evidence now passes:

```txt
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
# 30 passed
```

## Required Follow-up

Fix the live tournament result/next-hand progression path, then deploy a new committed head, verify `window.__MGX_BUILD_INFO__`, and rerun:

```bash
npx playwright test tests/e2e/live-deploy-verification.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-alpha-smoke.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-badugi-betting-closure.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
```
