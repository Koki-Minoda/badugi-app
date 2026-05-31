# MGX Alpha Preview Deploy Baseline

Date: 2026-05-16

Commit: `bb6594125d37449846da403b129a8a1c615b3294`

Branch: `feature/d-04-next-actor-unify`

## Worktree Cleanup

| Item | Result |
| --- | --- |
| tracked source diff | clean |
| Step59-65 untracked source/docs | stashed in `stash@{0}` |
| generated reports/screenshots/data | not committed |
| deploy snapshot | clean after baseline commit |

## Test Baseline

| Command | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:game:one-hand` | PASS, 53 tests |
| `npm run test:game:ev` | PASS, 14 tests |
| `npm run test:ai:iron` | PASS, 240 passed / 3 skipped |
| `npm run test:ai:pro` | PASS, 295 tests |
| `npm run test:rl:safety` | PASS, 52 tests |
| `npx vitest run src/games/badugi` | PASS, 123 tests |
| `npx playwright test tests/e2e/badugi-flow.spec.ts -g "Full 3-draw flow keeps card history intact" --project=badugi-flow` | PASS |
| `npx playwright test tests/e2e/badugi-full-round-pot-regression.spec.ts --project=badugi-flow` | PASS |
| `npx playwright test tests/e2e/alpha-variant-availability.spec.js --project=badugi-flow` | PASS, 4 tests |

## Deploy Scope

| Area | Result |
| --- | --- |
| alpha playable variants | D02 / S01 / S02 |
| Badugi | `preview_only` |
| Chinese / OFC | `coming_soon` |
| production routing | unchanged |
| Iron promotion | false |
| live RL mutation | false |
| model registry mutation | false |

## Notes

Badugi P0 automation is green, but Badugi remains preview-only until preview URL desktop and mobile checks pass.
