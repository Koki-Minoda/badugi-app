# MGX Physical Mobile QA Result

Date: 2026-05-19

This file records the latest physical-mobile release decision for the Core5 friend-alpha gate. Detailed Core5 device checklist rows remain in `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`.

## Current Decision

`HOLD`

Preview deploy now matches `a73042dcd2eca92097aa27a2d3f732b648fd49f4`. The latest iPhone evidence showed Badugi tournament rendering five-card draw-lowball hands after a cash-session variant switch; the hand-shape reset and folded-DRAW actor fixes are now deployed and live regressions pass, but real-device confirmation is still required.

- `PHYSICAL-MOBILE-BADUGI-WAITING-001`: `OPEN / NEEDS_RECHECK`
- `BADUGI-HAND-SHAPE-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-FOLD-DRAW-FREEZE-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-BET-DRAW-TRANSITION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW1-CPU-ACTION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW-BET-MIX-001`: `OPEN / NEEDS_RECHECK`
- `CROSS-VARIANT-STATE-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `TOUR-SEAT-LIFECYCLE-001`: `OPEN / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK`
- `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`: `OPEN P0 / FIXED_LOCAL_CANDIDATE`
- `BADUGI-CASH-OPENING-ACTOR-001`: `OPEN P0 / FIXED_LOCAL_CANDIDATE`

Use `https://mgx-poker.com/?mgxQa=mobile` and follow `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`.

`BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW1-CPU-ACTION-001`, `BADUGI-HAND-SHAPE-001`, `BADUGI-FOLD-DRAW-FREEZE-001`, and reopened `CROSS-VARIANT-STATE-001` are deployed at `a73042dcd2eca92097aa27a2d3f732b648fd49f4`; live cross-variant contamination regression and live Badugi tournament portrait/landscape 20-hand gates pass on that build. If any physical mobile issue reproduces, export the freeze report JSON and save a screenshot. Friend alpha remains HOLD until real-device recheck passes and remote sync is resolved.

## Required Recheck Evidence

- Device/browser.
- Live build commit and bundle shown in QA panel.
- QA sessionId.
- D01 cash -> Cash Out -> Menu -> Badugi tournament result.
- Badugi portrait 10-hand result.
- Badugi landscape 5-hand result.
- Freeze export status.
- CPU session export status.
- Busted/out CPU seat rail status: eliminated CPUs should not remain as large table panels.
- iPhone PWA/standalone landscape tournament action status: Hero Call/Raise/Fold must be fully visible and tappable without scroll.
- iPhone normal Safari landscape tournament action status: Hero Call/Raise/Fold must fit inside the visible `window.visualViewport`; Safari URL/tab bars cannot be forced hidden.
- Badugi cash opening actor status: start Badugi cash, confirm the first CPU/Hero actor progresses and no opening wait/freeze occurs.
- If CPU behavior feels fold-heavy, exported CPU session JSON and matching DB audit by sessionId.
