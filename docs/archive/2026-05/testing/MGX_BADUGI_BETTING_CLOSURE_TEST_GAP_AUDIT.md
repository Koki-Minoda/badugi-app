# MGX Badugi Betting Closure Test Gap Audit

Date: 2026-05-16

## Scope

This audit covers the P0 report where Hero raised, all remaining opponents called or folded, and Hero received another `Call / Raise / Fold` decision in the same Badugi betting round.

## Gap Summary

| Test Area | Existing Coverage | Missing | Risk |
|---|---|---|---|
| First actor tests | Covers initial actor and broad action order. | Does not prove a previous raiser is removed from the pending set after all callers match. | Stale raiser can re-act without a re-raise. |
| Full 3-draw browser flow | Reaches result and checks card/pot continuity. | Does not assert per-street `playersNeedingAction` after raise/call closure. | Round can visually continue while high-level flow still passes. |
| Pot regression | Verifies pot continuity. | Does not assert `actedThisRound` and contribution equality at round close. | Pot can be correct while turn election is stale. |
| Snapshot merge tests | Covers terminal and canonical actor basics. | Did not cover stale hero actor with `currentBet === heroContribution` and `hasActedThisRound === true`. | UI can show hero controls from stale turn metadata. |
| Re-raise behavior | Partially covered by fixed-limit cap tests. | Did not distinguish legal re-open from illegal raiser re-action after simple calls. | A fix could over-close and break legitimate re-raise action. |

## New Required Coverage

| Requirement | Added Test |
|---|---|
| Raise then all call closes the betting round. | `src/games/badugi/__tests__/badugiRaiseCallClosureRegression.test.js` |
| Hero is not reselected unless another player re-raises. | `src/games/badugi/__tests__/badugiRaiseCallClosureRegression.test.js` |
| Re-raise legitimately reopens Hero action. | `src/games/badugi/__tests__/badugiRaiseCallClosureRegression.test.js` |
| Stale hero actor cannot show controls when Hero has matched and acted. | `src/ui/__tests__/badugiRaiseCallClosureSnapshot.test.jsx` |
| Browser/E2E action history audit records the exact raise-call closure. | `tests/e2e/badugi-raise-call-round-closure.spec.ts` |

## Classification

`BADUGI-BET-REOPEN-001` is treated as P0 until the history audit proves:

- the raiser is marked acted after raising;
- callers remain pending until they match `currentBet`;
- `playersNeedingAction` becomes empty after the final call/fold;
- the betting round transitions to DRAW/SHOWDOWN;
- Hero controls remain hidden unless a later re-raise reopens action.
