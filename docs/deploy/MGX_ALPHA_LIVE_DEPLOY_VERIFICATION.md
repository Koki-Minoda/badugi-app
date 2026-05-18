# MGX Alpha Live Deploy Verification

Date: 2026-05-18

## Live Source Of Truth

| Item | Value |
| --- | --- |
| Live URL | `https://mgx-poker.com/` |
| Health endpoint | `https://mgx-poker.com/api/health` |
| Verification report | `reports/alpha/live-deploy-verification.json` |
| Live layout evidence | `reports/alpha/live-core5-layout-evidence-v2.json` |
| Live tournament fatal report | `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| Live Badugi betting closure report | `reports/alpha/live-badugi-betting-closure.json` |
| Live browser gameplay smoke | `reports/browser-gameplay/live-core5-smoke-summary.json` |
| Live browser desktop matrix | `reports/browser-gameplay/live-core5-desktop-20hand-summary.json` |
| Live browser mobile matrix | `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |

## Latest Verified Snapshot

| Field | Result |
| --- | --- |
| localHead | `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` |
| deployedCommit | `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` |
| deployedBundle | `/assets/index-BlAPEzcs.js` |
| matched | `true` |
| health | `PASS` |
| buildTime | `2026-05-18T05:50:46.654Z` |

## Live Blocker Evidence

The live deploy snapshot now matches local head `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` in `reports/alpha/live-deploy-verification.json`. The original D01/D02/S01/S02 tournament browser fatal has been fixed and the live fatal guard passes for all Core5 games.

```txt
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
# 5 passed
```

Classification:

| ID | Priority | Status | Evidence |
| --- | --- | --- | --- |
| `CORE5-UI-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts`; `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| `CORE5-TOUR-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-browser-gameplay-invariant.spec.ts`; `reports/browser-gameplay/live-core5-smoke-summary.json`; `reports/browser-gameplay/live-core5-desktop-20hand-summary.json`; `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |

The previous live tournament result-path blocker is not reproduced by the live browser gameplay invariant matrix. Live smoke completed 50/50 hands, live desktop matrix completed 200/200 hands, and live mobile emulation completed 200/200 hands. Remaining PHASE/POT rows are bounded monitor rows without stale controls, action reopen, terminal P0, UI/controller divergence, action application failure, or freeze.

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
