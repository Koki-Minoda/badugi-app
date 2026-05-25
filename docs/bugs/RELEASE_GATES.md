# Release Gates

Last updated: 2026-05-21

This is not a bug list. It is the mandatory gate map for friend alpha GO.

Current friend-alpha status: HOLD

HOLD reasons:
- Physical mobile QA is still pending for the Badugi/Core5 P0/P1 rows in `PHYSICAL_QA_PENDING.md`.
- Remote sync is still unresolved in `ACTIVE_BLOCKERS.md` (`PREVIEW-DEPLOY-02`).
- CPU/decision-density P1 quality rows remain active until deployed source attribution is proven.

## Mandatory GO Conditions

Friend alpha cannot be GO unless all of these are true:

| Gate | Required proof | Owner docs |
|---|---|---|
| Active blockers | No unresolved release-blocking P0/P1 in `ACTIVE_BLOCKERS.md`. | `ACTIVE_BLOCKERS.md` |
| Physical mobile | iPhone Safari/PWA and Android Chrome real-device evidence captured for required rows. | `PHYSICAL_QA_PENDING.md`; `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md` |
| Browser gameplay invariant | Core5 cash/tournament desktop/portrait/landscape matrices pass with no settled actor, terminal, action-application, pot-zero, or stale-control P0. | `docs/testing/MGX_BROWSER_GAMEPLAY_INVARIANT_GATE.md`; `docs/testing/MGX_CORE5_BROWSER_GAMEPLAY_MATRIX_GATE.md` |
| Cash lifecycle | Core5 cash lifecycle reaches terminal/result and next hand across Badugi/D01/D02/S01/S02. | `docs/testing/MGX_CORE5_CASH_LIFECYCLE_GATE.md` |
| Tournament lifecycle | Core5 tournament lifecycle reaches result/next-hand and handles bust/rebalance/payout paths. | `docs/testing/MGX_CORE5_TOURNAMENT_LIFECYCLE_GATE.md`; `docs/testing/MGX_TOURNAMENT_INTEGRATION_RELEASE_GATE.md` |
| Actor legality | Legal actions appear only for canonical actor; Hero controls hidden for non-Hero actor; folded/all-in/out players are not illegally elected. | `docs/testing/MGX_ACTION_ORDER_TEST_GAP_AUDIT.md`; `docs/testing/MGX_TURN_SOURCE_OF_TRUTH.md` |
| Phase machine | No impossible transition, mixed DRAW/BET controls, terminal actor, stale phase merge, or collect-with-pending-action in settled traces. | `docs/testing/MGX_CORE5_PHASE_MACHINE_SPEC.md` |
| Pot/chip continuity | No invalid active-hand `Total Pot 0`; terminal pot echo and next-hand reset remain distinct. | `docs/testing/MGX_EV_INTEGRITY_REPORT.md`; `VERIFIED_MONITORS.md` |
| Mobile layout | Desktop 1280x720, portrait 390x844/430x932, landscape 844x390/932x430 have usable controls/table/HUD. | `docs/alpha/MGX_CORE5_MOBILE_TOURNAMENT_LAYOUT_POLICY.md`; `docs/ui/MGX_MOBILE_LAYOUT_POLICY.md` |
| Deployment | Build info/live head matches intended release; remote branch is pushed; live smoke passes. | `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md`; deploy reports under `reports/alpha/` |
| CPU telemetry and gameplay quality | Deployed sessions can attribute CPU decision source; fold/nit/value-pressure rows are measured by sessionId. | `docs/testing/MGX_CORE5_CPU_STRATEGY_SANITY_AUDIT.md`; `docs/testing/MGX_LIVE_CPU_ACTION_DB_AUDIT.md` |

## Standard Automated Gate Commands

Use current package scripts/spec names from the repo. At minimum:

| Area | Gate |
|---|---|
| Known historical regressions | `npm run test:game:known-bugs` |
| Core5 action order | `npx playwright test tests/e2e/core5-action-order-audit.spec.ts --project=badugi-flow` |
| Impossible transitions | `npx playwright test tests/e2e/core5-impossible-transition.spec.ts --project=badugi-flow` |
| Cash lifecycle | `npx playwright test tests/e2e/core5-cash-full-lifecycle-gate.spec.ts --project=badugi-flow` |
| Tournament lifecycle | `npx playwright test tests/e2e/core5-tournament-full-lifecycle-gate.spec.ts --project=badugi-flow` |
| Browser gameplay matrix | `npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow` with Core5 variants/modes/viewports |
| Mobile policy | `npx playwright test tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts tests/e2e/mobile-tournament-visual-viewport.spec.ts tests/e2e/mobile-tournament-readability.spec.ts tests/e2e/mobile-battlefield-ratio.spec.ts tests/e2e/mobile-layout-mode-regression.spec.ts --project=badugi-flow` |
| Alpha mobile smoke | `npx playwright test tests/e2e/alpha-mobile-gameplay-layout.spec.ts tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow` |
| Deploy/live smoke | Live deploy verification and live browser invariant specs after a push/deploy |

## Physical Device Gate

Required real-device matrix before GO:

| Device/browser | Required coverage |
|---|---|
| iPhone Safari | Badugi cash opening actor; Badugi tournament full path; landscape controls; portrait readability. |
| iPhone PWA/standalone | Landscape visual viewport and action controls after rotation. |
| Android Chrome | Core5 portrait/landscape smoke and tournament control usability. |

Physical evidence must include:
- device/browser/orientation
- URL/build head
- scenario path
- screenshot/video or exported QA JSON
- pass/fail notes tied to bug ID

## GO/HOLD Rule

Do not recommend GO if any of these fail:
- active P0/P1 blocker remains open
- physical QA required row lacks real-device evidence
- Core5 Cash or Tournament progression gate fails
- mobile controls are clipped/unusable on physical device
- live deploy head does not match intended release
- actor/order/terminal/pot historical regression reappears
