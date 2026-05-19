# MGX Physical Mobile QA Result

Date: 2026-05-19

This file records the latest physical-mobile release decision for the Core5 friend-alpha gate. Detailed Core5 device checklist rows remain in `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`.

## Current Decision

`HOLD`

Preview deploy currently matches `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`, and the deployed bundle is `/assets/index-DT960jbi.js`. A newer local fix is now required before physical recheck because the latest iPhone evidence showed Badugi tournament rendering five-card draw-lowball hands after a cash-session variant switch. Local regressions now pass for D01/D02/S01/S02 cash -> Badugi tournament hand-shape reset and folded-DRAW actor handling, but those fixes still need deploy and physical confirmation.

- `PHYSICAL-MOBILE-BADUGI-WAITING-001`: `OPEN / NEEDS_RECHECK`
- `BADUGI-HAND-SHAPE-001`: `FIXED_LOCAL / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK`
- `BADUGI-FOLD-DRAW-FREEZE-001`: `FIXED_LOCAL / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK`
- `BADUGI-BET-DRAW-TRANSITION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW1-CPU-ACTION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW-BET-MIX-001`: `OPEN / NEEDS_RECHECK`
- `CROSS-VARIANT-STATE-001`: `FIXED_LOCAL / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK`

Use `https://mgx-poker.com/?mgxQa=mobile` and follow `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`.

`BADUGI-BET-DRAW-TRANSITION-001` and `BADUGI-DRAW1-CPU-ACTION-001` are fixed locally and deployed at `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`; live Badugi tournament emulation passed the 20-hand portrait and landscape gates on that build. The newer `BADUGI-HAND-SHAPE-001` / `BADUGI-FOLD-DRAW-FREEZE-001` / reopened `CROSS-VARIANT-STATE-001` fix must be deployed before the next real-device recheck. If any physical mobile issue reproduces, export the freeze report JSON and save a screenshot. Friend alpha remains HOLD until real-device recheck passes and remote sync is resolved.

## Required Recheck Evidence

- Device/browser.
- Live build commit and bundle shown in QA panel.
- QA sessionId.
- D01 cash -> Cash Out -> Menu -> Badugi tournament result.
- Badugi portrait 10-hand result.
- Badugi landscape 5-hand result.
- Freeze export status.
- CPU session export status.
- If CPU behavior feels fold-heavy, exported CPU session JSON and matching DB audit by sessionId.
