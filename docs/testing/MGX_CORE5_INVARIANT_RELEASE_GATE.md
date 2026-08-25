# MGX Core5 Invariant Release Gate

Date: 2026-05-17

## Scope

Core5 variants:

| Game | Variant |
|---|---|
| Badugi | `badugi` |
| 2-7 Triple Draw | `D01` |
| A-5 Triple Draw | `D02` |
| 2-7 Single Draw | `S01` |
| A-5 Single Draw | `S02` |

Modes:

- Cash
- Tournament

## Shared Hand Gate

Release requires all shared hand invariants to pass for both modes:

| Invariant | Required Result |
|---|---|
| actor order / actor eligibility | 0 violations |
| first/next actor consistency | 0 violations |
| folded/all-in skip | 0 violations |
| raise/call closure | 0 illegal re-action |
| re-raise reopen | only legal re-raise reopens action |
| currentBet / contribution | 0 mismatch |
| pot consistency | 0 active-hand total-pot-zero |
| draw count | variant max not exceeded |
| terminal transition | actor and action controls cleared |
| snapshot consistency | no stale `ACTING` / turn metadata mismatch |

## Required Commands

```bash
node scripts/run-core5-cash-lifecycle-invariant-sweep.js
node scripts/run-core5-tournament-lifecycle-invariant-sweep.js
npm test -- src/engine/invariant
```

The Playwright lifecycle gates are split by mode. Cash passing alone is not enough. Tournament passing alone is not enough.

## Status

`LOCAL_AUTOMATED_PASS_LIVE_AND_PHYSICAL_PENDING`

The invariant framework, synthetic lifecycle sweeps, unit invariant tests, and browser lifecycle gates pass locally for both Cash and Tournament modes.

## Evidence

| Gate | Result | Evidence |
|---|---|---|
| Shared invariant unit tests | PASS | `npm test -- src/engine/invariant`: 10 files / 15 tests PASS |
| Cash lifecycle sweep | PASS | 6,000 hands simulated; 60 sessions completed; 0 invariant, actor, action-reopen, pot, cash-out, menu-return, or freeze failures |
| Tournament lifecycle sweep | PASS | 1,200 tournaments simulated; 0 invariant, actor, busted-actor, champion, payout, feedback, menu-return, or freeze failures |
| Cash browser lifecycle gate | PASS | `core5-cash-full-lifecycle-gate.spec.ts`: 5/5 variants PASS |
| Tournament browser lifecycle gate | PASS | `core5-tournament-full-lifecycle-gate.spec.ts`: 5/5 variants PASS |
| Individual Cash lifecycle E2E specs | PASS | 25/25 browser checks PASS |
| Individual Tournament lifecycle E2E specs | PASS | 30/30 browser checks PASS |

This is a local automated lifecycle pass. It does not clear live deploy mismatch, live tournament runtime, physical mobile QA, or remote sync blockers.
