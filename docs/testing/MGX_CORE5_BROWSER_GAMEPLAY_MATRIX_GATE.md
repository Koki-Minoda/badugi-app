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
| B | Core5 cash desktop 100-hand | PARTIAL_FIX / BLOCKED: S01/S02 100-hand pass; D01/D02 100-hand runtime pending |
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

`BLOCKED_AT_STEP_B_TRIPLE_DRAW_100HAND_RUNTIME_PENDING`

Core5 cash desktop 10-hand passed. The original S01/S02 late-hand draw/terminal P0 is fixed locally and S01/S02 100-hand now pass. D02's CPU draw fallback failure is fixed for 30-hand coverage. Step B is still not a release PASS because D01/D02 100-hand runs did not complete within the current practical runtime window, so tournament, viewport, and live matrix expansion remain blocked.
