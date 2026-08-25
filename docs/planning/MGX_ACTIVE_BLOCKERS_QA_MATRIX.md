# MGX Active Blockers QA Matrix

Last updated: 2026-05-21

This matrix defines required later-execution QA. It records planned gates only; no product/test/runtime code is changed by this planning pass.

## Universal Integration Matrix

After every blocker fix, run the affected focused tests plus this 10-cell matrix:

| Mode | Desktop 1280x720 | Portrait 390x844 | Portrait 430x932 | Landscape 844x390 | Landscape 932x430 |
|---|---|---|---|---|---|
| Cash | required | required | required | required | required |
| Tournament | required | required | required | required | required |

Required assertions:
- legal actor only
- Hero controls visible only for legal Hero actor
- controls hidden when not legal
- no stale turn after terminal
- no all-in actor election
- no folded-player revival
- betting round closes
- draw round closes
- result reachable
- next hand reachable
- controls tappable
- no HUD overlap
- no viewport clipping
- pot continuity
- no BET/DRAW mixed state

If shared actor/snapshot/controller logic changes, expand from affected variant to all Core5 variants:
- Badugi
- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

## Standard Gate Commands For Later Execution

| Gate | Command / spec |
|---|---|
| Known historical regressions | `npm run test:game:known-bugs` |
| Actor legality audit | `npx playwright test tests/e2e/core5-action-order-audit.spec.ts --project=badugi-flow` |
| Impossible transition / mixed phase detector | `npx playwright test tests/e2e/core5-impossible-transition.spec.ts --project=badugi-flow` |
| Cash lifecycle | `npx playwright test tests/e2e/core5-cash-full-lifecycle-gate.spec.ts --project=badugi-flow` |
| Tournament lifecycle | `npx playwright test tests/e2e/core5-tournament-full-lifecycle-gate.spec.ts --project=badugi-flow` |
| Browser gameplay invariant matrix | `npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow` with selected `BROWSER_GAMEPLAY_*` environment |
| Mobile policy suite | `npx playwright test tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts tests/e2e/mobile-tournament-visual-viewport.spec.ts tests/e2e/mobile-tournament-readability.spec.ts tests/e2e/mobile-battlefield-ratio.spec.ts tests/e2e/mobile-layout-mode-regression.spec.ts --project=badugi-flow` |
| Alpha mobile smoke | `npx playwright test tests/e2e/alpha-mobile-gameplay-layout.spec.ts tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow` |
| Tournament integration | `npx playwright test tests/e2e/tournament/*.spec.ts --project=badugi-flow` plus relevant unit tests when tournament behavior changes |
| Live/deploy smoke | Live deploy verification and live browser invariant specs after credentialed push/deploy |

## Per-Blocker QA Ownership

| Blocker | Focused proof first | Integration matrix scope | Historical guard | Physical QA | Telemetry/sessionId proof |
|---|---|---|---|---|---|
| `BADUGI-CASH-OPENING-ACTOR-001` | Badugi cash opening unit/UI/E2E. | Badugi 10-cell; Core5 if shared snapshot/actor changes. | Required. | Required iPhone Safari cash opening actor. | N/A |
| `BADUGI-BET-DRAW-TRANSITION-001` | Badugi BET-to-DRAW unit/UI/E2E. | Badugi 10-cell; Core5 if phase/controller shared changes. | Required. | Required iPhone Safari/PWA tournament BET closure. | N/A |
| `BADUGI-DRAW-BET-MIX-001` | Mixed DRAW/BET detector; export-derived regression if reproduced. | Badugi 10-cell; Core5 if detector/source shared changes. | Required. | Required iPhone Safari/PWA no mixed controls. | N/A |
| `BADUGI-DRAW1-CPU-ACTION-001` | CPU DRAW action unit/UI/E2E/live focused regression. | Badugi 10-cell; Core5 if draw path shared changes. | Required. | Required iPhone Safari/PWA DRAW1 CPU action. | N/A |
| `BADUGI-FOLD-DRAW-FREEZE-001` | Folded draw actor/waiting unit/UI/E2E. | Badugi 10-cell; Core5 if draw eligibility shared changes. | Required. | Required physical Hero fold in DRAW. | N/A |
| `PHYSICAL-MOBILE-BADUGI-WAITING-001` | Child blocker focused tests plus freeze detector if export exists. | Badugi tournament/mobile matrix; Core5 if contamination path changes. | Required. | Required full physical Badugi tournament recheck. | N/A |
| `CROSS-VARIANT-STATE-001` | Cross-variant state reset and controller boundary regressions. | All Core5 10-cell if variant/session merge changes. | Required. | Required cash variants into Badugi tournament. | N/A |
| `BADUGI-HAND-SHAPE-001` | Badugi hand-shape invariant/snapshot/cross-variant tests. | Badugi plus all Core5 if sanitizer changes. | Required. | Required physical four-card Badugi confirmation. | N/A |
| `TOUR-SEAT-LIFECYCLE-001` | Tournament busted seat display/eligibility/readability specs. | Core5 tournament 10-cell if shared projection changes. | Required. | Required busted-seat rail/readability proof. | N/A |
| `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | Landscape action buttons, iPhone Safari controls, visual viewport specs. | Badugi mobile tournament plus Core5 mobile policy if layout shared changes. | Required. | Required iPhone Safari and PWA landscape. | N/A |
| `UI-MOBILE-TABLE-DENSITY-001` | Mobile readability and battlefield ratio specs. | Badugi/D01 tournament mobile, expand Core5 if layout shared changes. | Required. | Required portrait/landscape readability. | N/A |
| `UI-MOBILE-HUD-OVERLAY-001` | Battlefield/HUD structural specs. | Tournament mobile policy matrix. | Required. | Required no HUD overlap on real device. | N/A |
| `UI-MOBILE-LANDSCAPE-CONTROLS-001` | Layout mode and landscape control specs. | Tournament mobile landscape matrix. | Required. | Required physical landscape tap proof. | N/A |
| `UI-MOBILE-LAYOUT-MODE-001` | Mobile layout mode regression. | Cash/tournament portrait/landscape matrix for affected variants. | Required. | Required physical orientation mode proof. | N/A |
| `D01-BLIND-POSTING-001` | D01 blind invariant/snapshot/E2E. | D01 10-cell; Core5 if dealer/blind adapter shared changes. | Required. | Required D01 physical blind/position trace. | N/A |
| `BG-005` | Child physical blocker tests plus alpha/mobile smoke. | Core5 mobile cash/tournament matrix. | Required. | Required iOS/Android checklist. | N/A |
| `PREVIEW-DEPLOY-02` | Pre-push status and build-info checklist. | Live smoke after credentialed deploy. | Required after deploy. | N/A | N/A |
| `UI-REPLAY-READABILITY-001` | Replay grouped-view regression before implementation. | Replay readability smoke; no Core5 matrix unless gameplay state changes. | Required if shared replay/history code changes. | N/A | N/A |
| `CORE5-CPU-FOLD-001` | CPU metadata persistence and live DB audit. | No gameplay matrix unless CPU runtime strategy changes. | Required if strategy/runtime changes. | Optional physical/live cash session. | Required sessionId fold/source audit. |
| `BADUGI-CPU-VALUE-BET-001` | Badugi value-pressure regression and live pressure-row audit. | Badugi gameplay matrix only if action selection changes. | Required if CPU action logic changes. | Optional physical/live Badugi session. | Required pro-overlay pressure-row proof. |
| `CPU-TOO-NIT-001` | Tournament AI feedback / decision-density audit. | Tournament matrix only if CPU action logic changes. | Required if strategy/runtime changes. | Optional physical tournament session. | Required tournament sessionId source/density audit. |
| `MEANINGFUL-DECISION-001` | Meaningful-decision density report. | Tournament matrix only if CPU action logic changes. | Required if strategy/runtime changes. | Optional physical/live tournament session. | Required deployed density proof. |

## Physical QA Evidence Packet

For every physical-QA-required blocker, external QA must capture:
- blocker ID
- device
- browser
- PWA/non-PWA
- orientation
- viewport
- build info / commit head
- URL and route
- variant
- mode
- sessionId
- screenshots or video
- action history
- console errors
- exported freeze JSON if reproduced
- pass/fail conclusion and remaining risk

## Matrix Result Template

Use this exact block in `MGX_ACTIVE_BLOCKERS_PROGRESS.md` after later execution:

```md
Integration matrix:
- Cash desktop 1280x720: PASS/FAIL/NOT RUN
- Cash portrait 390x844: PASS/FAIL/NOT RUN
- Cash portrait 430x932: PASS/FAIL/NOT RUN
- Cash landscape 844x390: PASS/FAIL/NOT RUN
- Cash landscape 932x430: PASS/FAIL/NOT RUN
- Tournament desktop 1280x720: PASS/FAIL/NOT RUN
- Tournament portrait 390x844: PASS/FAIL/NOT RUN
- Tournament portrait 430x932: PASS/FAIL/NOT RUN
- Tournament landscape 844x390: PASS/FAIL/NOT RUN
- Tournament landscape 932x430: PASS/FAIL/NOT RUN
```

## Stop Rule

If any required matrix or historical guard fails, stop new blocker work and record:
- failing blocker
- command/scenario
- artifact path
- suspected root cause
- rollback/containment recommendation
- next single-blocker action
