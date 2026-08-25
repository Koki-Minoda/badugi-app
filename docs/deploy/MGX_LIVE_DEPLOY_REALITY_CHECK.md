# MGX Live Deploy Reality Check

Date: 2026-05-16

Target URL: https://mgx-poker.com/

## Decision

`LIVE_ALPHA_HOLD`

The live deploy is healthy at `/api/health`, but the deployed frontend commit does not match local HEAD and live tournament evidence still has a P0 browser fatal for D01/D02/S01/S02 tournament launch states. The Core5 action-order audit passed on live action history, so the reported BB/order concern is not reproduced as an actor-order bug in this pass.

## Deploy Snapshot

| Item | Value |
| --- | --- |
| localHead | `e8d94f9d0e49d61713db41025d81d9a3ccd601e8` |
| deployedCommit | `f2c36e7ec833153b8428da07918bf7c8fb3ee234` |
| deployedBundle | `/assets/index-Dt7nwlgG.js` |
| buildTime | `2026-05-16T14:15:20.479Z` |
| appVersion | `0.0.0` |
| health | PASS: `{"status":"ok","env":"prod","db":"ok"}` |
| HTTP | 200, `last-modified: Sat, 16 May 2026 14:15:28 GMT` |
| matched | false |

## Live Layout Evidence

Report: `reports/alpha/live-core5-layout-evidence.json`

| Game | Mode | Viewport | Result | Evidence |
| --- | --- | --- | --- | --- |
| Badugi | cash | 390x844, 430x932 | PASS | `reports/screenshots/live-core5-badugi-cash-*.png` |
| Badugi | tournament | 390x844, 430x932, 844x390 | PASS | `reports/screenshots/live-core5-badugi-tournament-*.png` |
| D01 / 2-7TD | cash | 390x844, 430x932 | PASS | `reports/screenshots/live-core5-d01-cash-*.png` |
| D01 / 2-7TD | tournament | 390x844, 430x932, 844x390 | FAIL | fatal console: `applyPlayerAction is not a function`; screenshots under `reports/screenshots/live-core5-d01-tournament-*.png` |
| D02 / A-5TD | cash | 390x844, 430x932 | PASS | `reports/screenshots/live-core5-d02-cash-*.png` |
| D02 / A-5TD | tournament | 390x844, 430x932, 844x390 | FAIL | fatal console: `applyPlayerAction is not a function`; screenshots under `reports/screenshots/live-core5-d02-tournament-*.png` |
| S01 / 2-7SD | cash | 390x844, 430x932 | PASS | `reports/screenshots/live-core5-s01-cash-*.png` |
| S01 / 2-7SD | tournament | 390x844, 430x932, 844x390 | FAIL | fatal console: `applyPlayerAction is not a function`; screenshots under `reports/screenshots/live-core5-s01-tournament-*.png` |
| S02 / A-5SD | cash | 390x844, 430x932 | PASS | `reports/screenshots/live-core5-s02-cash-*.png` |
| S02 / A-5SD | tournament | 390x844, 430x932, 844x390 | FAIL | fatal console: `applyPlayerAction is not a function`; screenshots under `reports/screenshots/live-core5-s02-tournament-*.png` |

Summary: 13/25 live layout evidence cases pass. The 12 failures are all D01/D02/S01/S02 tournament mode cases and are caused by the same browser fatal console error. This pass does not classify those screenshots as table-collapse failures; the hard blocker is the runtime fatal on live tournament variants.

## Live Action-Order Evidence

Report: `reports/alpha/live-core5-action-order-audit.json`

| Game | Rows | Invalid Actor Rows | Hero-Control Mismatches | Result |
| --- | ---: | ---: | ---: | --- |
| Badugi | 24 | 0 | 0 | PASS |
| D01 / 2-7TD | 12 | 0 | 0 | PASS |
| D02 / A-5TD | 12 | 0 | 0 | PASS |
| S01 / 2-7SD | 7 | 0 | 0 | PASS |
| S02 / A-5SD | 8 | 0 | 0 | PASS |

The live action-history audit did not reproduce a fixed-opposite-seat actor bug or BB-before-UTG violation. Expected and actual actors matched on every audited betting action.

## Required Follow-Up

1. Fix the live tournament fatal for D01/D02/S01/S02: `applyPlayerAction is not a function`.
2. Re-deploy from local HEAD or newer and verify `window.__MGX_BUILD_INFO__` matches the intended commit.
3. Re-run `tests/e2e/live-core5-layout-regression.spec.ts` against `https://mgx-poker.com/`.
4. Keep `tests/e2e/live-core5-action-order-audit.spec.ts` in the live release gate.
5. Friend alpha remains HOLD until live layout/tournament evidence is clean and physical mobile QA is complete.
