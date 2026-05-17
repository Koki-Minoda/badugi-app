# MGX Core5 Browser Gameplay Matrix Gate

Date: 2026-05-17

## Scope

This gate expands the browser gameplay invariant harness from Badugi-only coverage to Core5:

| Dimension | Scope |
|---|---|
| Variants | Badugi, D01, D02, S01, S02 |
| Modes | Cash, Tournament |
| Viewports | desktop 1280x720, portrait 390x844, landscape 844x390 |
| Evidence | browser action trace, invariant summary, failure JSON, screenshots |

## Expansion Order

| Step | Matrix | Status |
|---|---|---|
| A | Core5 cash desktop 10-hand | PASS after draw current-bet helper normalization |
| B | Core5 cash desktop 100-hand | FAIL, expansion stopped |
| C | Core5 tournament desktop 20-hand | NOT RUN |
| D | Core5 tournament desktop 100-hand | NOT RUN |
| E | Core5 portrait/landscape matrix | NOT RUN |
| F | live preview browser matrix | NOT RUN |

## Pass Conditions

Each step must meet all of these before continuing:

| Invariant | Requirement |
|---|---|
| Actor | no illegal actor and no non-hero controls when another actor is canonical |
| Betting closure | no stale actor after all required actions resolve |
| Action reopen | no re-action without a re-raise or pending action |
| Draw | no selected draw actor that cannot legally draw |
| Terminal | actor cleared, controls hidden, result/next-hand path usable |
| Pot | no active-hand pot zero; display/controller pot differences classified |
| Runtime | no fatal console/page error and no freeze |

## Current Gate Decision

`FAIL_AT_STEP_B_CORE5_CASH_DESKTOP_100HAND`

Core5 cash desktop 10-hand passed. The 100-hand expansion failed, so tournament, viewport, and live matrix expansion remain blocked.

