# MGX Alpha Pre-Deploy Core5 Tournament Layout Baseline

Date: 2026-05-16T13:38:39Z

Branch: `feature/d-04-next-actor-unify`

Commit: `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`

## Scope

This baseline verifies the latest Core5 mobile tournament layout fix before updating the preview deploy. It does not change production routing, model promotion, live RL, game logic, rules, evaluators, or variant availability.

## Result

Pre-deploy baseline: PASS

## Command Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run build` | PASS | Vite build completed. Large bundle warning unchanged. |
| `npm run test:game:one-hand` | PASS | 2 files, 53 tests. |
| `npm run test:game:ev` | PASS | 1 file, 14 tests. |
| `npm run test:ai:iron` | PASS | 185 files, 240 passed, 3 skipped. |
| `npm run test:ai:pro` | PASS | 2 files, 295 tests. |
| `npm run test:rl:safety` | PASS | 8 files, 52 tests. |
| `npx playwright test tests/e2e/core5-mobile-tournament-layout-regression.spec.ts --project=badugi-flow` | PASS | 20/20. |
| `npx playwright test tests/e2e/core5-mobile-tournament-portrait-layout.spec.ts --project=badugi-flow` | PASS | 10/10 after rerun. One transient Badugi console mismatch on first full run passed on exact rerun and full rerun. |
| `npx playwright test tests/e2e/core5-mobile-tournament-landscape-layout.spec.ts --project=badugi-flow` | PASS | 10/10. |
| `npx playwright test tests/e2e/core5-mobile-portrait-layout-visual.spec.ts --project=badugi-flow` | PASS | 10/10. |
| `npx playwright test tests/e2e/core5-mobile-interaction.spec.ts --project=badugi-flow` | PASS | 10/10. |

## Deployment Gate

The preview deploy can be updated to include:

- `bd6dcc5` `test(ui): cover core five mobile tournament layout`
- `cd03462` `fix(ui): recover core five mobile tournament layout`
- `d91d7e0` `docs(alpha): update mobile tournament layout readiness`

Physical mobile QA remains required before changing the Friend Alpha decision to GO.
