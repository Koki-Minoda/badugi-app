# MGX Physical Mobile QA Result

Date: 2026-05-19

This file records the latest physical-mobile release decision for the Core5 friend-alpha gate. Detailed Core5 device checklist rows remain in `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`.

## Current Decision

`HOLD`

Preview deploy now matches local head `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`, and the deployed bundle is `/assets/index-DT960jbi.js`. Live cross-variant contamination recheck passes, the focused Badugi DRAW1 CPU action regression passes live, and Badugi tournament portrait/landscape live emulation completes 20 hands each with 0 invariant failures. The remaining physical mobile Badugi findings still require real-device recheck:

- `PHYSICAL-MOBILE-BADUGI-WAITING-001`: `OPEN / NEEDS_RECHECK`
- `BADUGI-BET-DRAW-TRANSITION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW1-CPU-ACTION-001`: `FIXED_LIVE / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW-BET-MIX-001`: `OPEN / NEEDS_RECHECK`

Use `https://mgx-poker.com/?mgxQa=mobile` and follow `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`.

`BADUGI-BET-DRAW-TRANSITION-001` and `BADUGI-DRAW1-CPU-ACTION-001` are fixed locally and deployed at `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`; live Badugi tournament emulation now passes the 20-hand portrait and landscape gates. If either physical mobile issue reproduces, export the freeze report JSON and save a screenshot. Friend alpha remains HOLD until real-device recheck passes and remote sync is resolved.
