# MGX Physical Mobile QA Result

Date: 2026-05-18

This file records the latest physical-mobile release decision for the Core5 friend-alpha gate. Detailed Core5 device checklist rows remain in `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`.

## Current Decision

`HOLD`

Preview deploy now matches local head `77265c4bc7718085cc7d9d686f481ec77f66ffbd`, and the deployed bundle is `/assets/index-CzoXsOzq.js`. Live cross-variant contamination recheck passes, but the remaining physical mobile Badugi findings are still not cleared by automation:

- `PHYSICAL-MOBILE-BADUGI-WAITING-001`: `OPEN / NEEDS_RECHECK`
- `BADUGI-BET-DRAW-TRANSITION-001`: `DEPLOYED / LIVE_EMULATION_BLOCKED / NEEDS_PHYSICAL_RECHECK`
- `BADUGI-DRAW1-CPU-ACTION-001`: `OPEN / NEEDS_FIX`
- `BADUGI-DRAW-BET-MIX-001`: `OPEN / NEEDS_RECHECK`

Use `https://mgx-poker.com/?mgxQa=mobile` and follow `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`.

`BADUGI-BET-DRAW-TRANSITION-001` is fixed locally by the focused BET-to-DRAW regression and deployed at `77265c4bc7718085cc7d9d686f481ec77f66ffbd`, but the live Badugi mobile emulation matrix still stops on `BADUGI-DRAW1-CPU-ACTION-001` before it can prove the 20-hand portrait/landscape gate. If either mobile issue reproduces, export the freeze report JSON and save a screenshot. Friend alpha remains HOLD until live emulation and real-device recheck pass and remote sync is resolved.
