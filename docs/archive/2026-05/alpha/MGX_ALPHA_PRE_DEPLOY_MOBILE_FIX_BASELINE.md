# MGX Alpha Pre-deploy Mobile Fix Baseline

Date: 2026-05-16

## Snapshot

| Item | Result |
| --- | --- |
| Branch | `feature/d-04-next-actor-unify` |
| Commit | `f121d732dd0a1debf699eb43699484e06d0a5c1d` |
| Mobile fix included | true |
| Badugi availability | `preview_only` |
| Alpha playable variants | D02 / S01 / S02 |

## Verification

| Command | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:game:one-hand` | PASS |
| `npm run test:game:ev` | PASS |
| `npm run test:ai:iron` | PASS |
| `npm run test:ai:pro` | PASS |
| `npm run test:rl:safety` | PASS |
| `npx playwright test tests/e2e/alpha-variant-availability.spec.js --project=badugi-flow` | PASS, 4/4 |
| `npx playwright test tests/e2e/alpha-playable-variants-smoke.spec.ts --project=badugi-flow` | PASS, 12/12 |
| `npx playwright test tests/e2e/alpha-mobile-gameplay-layout.spec.ts --project=badugi-flow` | PASS, 12/12 |

## Decision

The mobile overflow fix is verified in local build, unit/integration gates, and Playwright mobile emulation. Deploy may proceed for preview validation.
