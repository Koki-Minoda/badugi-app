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
| E | Core5 portrait/landscape matrix | PASS, 10-hand/20-hand/50-hand local mobile matrices pass |
| F | live preview browser matrix | PASS, live smoke/desktop/mobile matrices pass |

## Pass Conditions

Each step must meet all of these before continuing:

| Invariant | Requirement |
|---|---|
| Actor | no illegal actor and no non-hero controls when another actor is canonical |
| Betting closure | no stale actor after all required actions resolve |
| Action reopen | no re-action without a re-raise or pending action |
| Draw | no selected draw actor that cannot legally draw |
| Terminal | actor cleared, controls hidden, result/next-hand path usable |
| Phase machine | no impossible transition, no DRAW/BET mixed snapshot, no stale controller-source phase merge, no terminal actor |
| Pot | no active-hand pot zero; display/controller pot differences classified |
| Runtime | no fatal console/page error and no freeze |

## Current Gate Decision

`STEP_F_PASS__LIVE_BROWSER_MATRIX_CLEAN__PHYSICAL_QA_AND_REMOTE_SYNC_PENDING`

Core5 cash desktop 10-hand passed. The original S01/S02 late-hand draw/terminal P0 is fixed locally and S01/S02 100-hand now pass. D02's CPU draw fallback path is present. The D01 fold-to-one collect terminal path is fixed locally. The later D01 actor/source divergence was traced to the browser collector and E2E progress helper mixing stale `phaseState` fields with the newer session controller snapshot; both now prefer `controllerSnapshot` for phase, players, and hand id. D01 cash desktop 30-hand, D01 100-hand, and D02 100-hand pass with no actor P0, terminal P0, illegal reopen, action application failure, or real freeze.

Tournament desktop expansion is now clean locally. Step C passed Core5 tournament desktop 20-hand. Step D passed Core5 tournament desktop 100-hand with 500/500 hands complete, 13,062 actions observed, and 0 invariant violations. The initial tournament draw-lowball action application failure was fixed by allowing controller-backed tournament variants to use the active session/draw-lowball controller path.

Mobile portrait/landscape expansion is also clean locally. Step E passed the 10-hand smoke, 20-hand matrix, and 50-hand matrix across Badugi/D01/D02/S01/S02, cash/tournament, and portrait/landscape. The final 50-hand mobile matrix completed 1000/1000 hands with 23,358 actions observed and no actor P0, terminal P0, illegal reopen, UI/controller divergence, action application failure, real freeze, or fatal console/page error. Remaining PHASE/POT rows are monitor-only timing rows without stale controls.

Live preview expansion is clean against `https://mgx-poker.com/`. Step F first verified deploy reality: live commit `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` matches local head and bundle `/assets/index-BlAPEzcs.js`. The live smoke completed 50/50 hands, the live desktop matrix completed 200/200 hands, and the live mobile emulation matrix completed 200/200 hands. No actor P0, terminal P0, illegal reopen, UI/controller divergence, action application failure, freeze, or fatal live error was observed. Remaining PHASE/POT rows are bounded monitor-only timing rows. Badugi live no-reraise closure and re-raise-positive proof both pass.

Phase machine hardening is clean locally. The legal graph and impossible-transition detectors pass focused unit/E2E regressions. The full local Core5 50-hand matrix completed 1500/1500 hands with 0 phase-machine P0 rows. A follow-up 5-hand Core5 matrix after display-lag classification completed 150/150 hands and reported 0 `STALE_PHASE_MERGE`, 0 `DRAW_BET_MIXED_STATE`, 0 `IMPOSSIBLE_PHASE_TRANSITION`, and 0 `TERMINAL_WITH_ACTOR`. Remaining PHASE/POT rows are timing monitor rows only.

## Current Required Recheck

1. Keep the local Step E, phase-machine, and live Step F traces under monitor for D01/D02 tournament portrait/landscape and Badugi closure behavior.
2. Re-run phase-machine detectors after any engine/controller/snapshot merge change.
3. Keep friend alpha HOLD until physical mobile QA and remote sync are resolved.
