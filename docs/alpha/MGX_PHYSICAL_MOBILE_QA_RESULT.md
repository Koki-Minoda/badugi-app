# MGX Physical Mobile QA Result

Date: 2026-05-18

This file records the latest physical-mobile release decision for the Core5 friend-alpha gate. Detailed Core5 device checklist rows remain in `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`.

## Current Decision

`HOLD`

Preview deploy now matches local head `72e306f9e3dde6ea0c1f71b39dafda4b10889ba0`, and the deployed bundle is `/assets/index-CisEAtSU.js`. The remaining physical mobile Badugi findings are still not cleared by automation:

- `PHYSICAL-MOBILE-BADUGI-WAITING-001`: `OPEN / NEEDS_RECHECK`
- `BADUGI-BET-DRAW-TRANSITION-001`: `FIXED_LOCAL / NEEDS_LIVE_AND_PHYSICAL_RECHECK`
- `BADUGI-DRAW-BET-MIX-001`: `OPEN / NEEDS_RECHECK`

Use `https://mgx-poker.com/?mgxQa=mobile` and follow `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`.

`BADUGI-BET-DRAW-TRANSITION-001` is fixed locally by the focused BET-to-DRAW regression, but it remains a release P0 until deployed and rechecked on a real device. If either mobile issue reproduces, export the freeze report JSON and save a screenshot. Friend alpha remains HOLD until the real-device recheck passes and remote sync is resolved.
