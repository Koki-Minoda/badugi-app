# MGX Core5 Browser Gameplay Matrix Gate

Date: 2026-05-18

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
| B | Core5 cash desktop 100-hand | PASS: S01/S02 100-hand pass; focused D01 fold-to-one collect passes; D01 30-hand, D01 100-hand, and D02 100-hand pass after controller snapshot source-priority fix |
| C | Core5 tournament desktop 20-hand | PASS, 5/5 variants |
| D | Core5 tournament desktop 100-hand | PASS, 500/500 hands, 0 invariant violations |
| E | Core5 portrait/landscape matrix | READY TO RUN / NOT RUN |
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

`STEP_D_PASS__LOCAL_DESKTOP_MATRIX_CLEAN__MOBILE_MATRIX_ALLOWED`

Core5 cash desktop 10-hand passed. The original S01/S02 late-hand draw/terminal P0 is fixed locally and S01/S02 100-hand now pass. D02's CPU draw fallback path is present. The D01 fold-to-one collect terminal path is fixed locally. The later D01 actor/source divergence was traced to the browser collector and E2E progress helper mixing stale `phaseState` fields with the newer session controller snapshot; both now prefer `controllerSnapshot` for phase, players, and hand id. D01 cash desktop 30-hand, D01 100-hand, and D02 100-hand pass with no actor P0, terminal P0, illegal reopen, action application failure, or real freeze.

Tournament desktop expansion is now clean locally. Step C passed Core5 tournament desktop 20-hand. Step D passed Core5 tournament desktop 100-hand with 500/500 hands complete, 13,062 actions observed, and 0 invariant violations. The initial tournament draw-lowball action application failure was fixed by allowing controller-backed tournament variants to use the active session/draw-lowball controller path.

## Current Required Recheck

1. Run Core5 portrait/landscape browser matrix.
2. If local mobile matrix is clean, proceed to live preview browser matrix.
3. Keep friend alpha HOLD until live preview matrix, physical mobile QA, and remote sync are resolved.
