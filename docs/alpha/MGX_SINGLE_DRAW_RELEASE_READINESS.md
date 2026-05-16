# MGX Single Draw Release Readiness

Date: 2026-05-16

Scope: `S01` / `deuce_to_seven_single_draw` and `S02` / `ace_to_five_single_draw`.

## Decision

`SINGLE_DRAW_BLOCKED_BY_POT_BUG`

Single Draw availability is not changed by this audit. `S01` and `S02` remain alpha candidates behind the existing variant gate, but release readiness is not fully cleared until canonical snapshot pot handling and the all-in draw eligibility mismatch are resolved or explicitly re-specified.

## Gate Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| 2-7SD variant mapping | PASS | `S01` maps to `deuce_to_seven_single_draw`; `D01` remains Triple Draw. |
| A-5SD variant mapping | PASS | `S02` maps to `ace_to_five_single_draw`; `D02` remains Triple Draw. |
| Display / engine alignment | PASS | Engine display names and route aliases match `2-7 Single Draw` and `A-5 Single Draw`. |
| Draw count | PASS | Both engines set `maxDrawRounds=1`; focused tests reject draw 2 and draw 3. |
| Hand size | PASS | Both variants inherit 5-card draw-lowball hand setup. |
| 2-7 evaluator | PASS | Ace high, straight penalty, flush penalty, and pair penalty fixtures pass for `S01`. |
| A-5 evaluator | PASS | Ace low, A-2-3-4-5 best, straight ignored, flush ignored, and pair penalty fixtures pass for `S02`. |
| Betting order | PASS | 6max/3way pre-draw actor starts left of BB; HU starts BTN/SB; post-draw starts left of button. |
| Pot continuity | FAIL | `SD-POT-001`: canonical `snapshot.pot` is `0` immediately after blind posting and after next-hand reset, even though blind obligations exist. Transition tests keep that value stable, but the Step4 spec requires blinds to create a nonzero active pot. |
| UI snapshot actor merge | PASS | Canonical `turn`/`nextTurn` wins over stale metadata for `S01` and `S02`. |
| Browser focused progression | PASS | Focused browser E2E reaches hand result through exactly one draw round for both variants. |
| All-in draw skip | FAIL | `27SD-PROG-001` / `A5SD-PROG-001`: all-in seats can be elected as draw actors, contrary to the Step4 spec. |
| Side-pot release evidence | WARN | S01/S02-specific all-in side-pot browser release gate is still missing. |

## Release Blockers

| ID | Priority | Title | Status | Required Fix |
| --- | --- | --- | --- | --- |
| `SD-POT-001` | P1 | Blind-posted Single Draw hand has canonical snapshot pot `0` | OPEN | Decide whether canonical `snapshot.pot` must include blinds immediately or whether all consumers must derive active pot from committed bets; then update implementation/spec and convert expected-fail pot tests. |
| `27SD-PROG-001` | P1 | 2-7SD all-in player can be elected as draw actor | OPEN | Update inherited draw eligibility to skip all-in seats for `S01`, or explicitly revise the rule spec, then convert the expected-fail regression into a passing test. |
| `A5SD-PROG-001` | P1 | A-5SD all-in player can be elected as draw actor | OPEN | Update inherited draw eligibility to skip all-in seats for `S02`, or explicitly revise the rule spec, then convert the expected-fail regression into a passing test. |
| `SD-PROG-002` | P2 | Missing S01/S02 all-in side-pot browser release gate | OPEN | Add a Single Draw multiway all-in/side-pot browser gate before final friend-alpha release confidence. |

## Availability

This Step4 audit does not promote, demote, reroute, or newly expose Single Draw. The audit confirms that Single Draw is not mixed with Triple Draw and that 2-7/A-5 evaluators are separated, but release readiness remains blocked by the all-in draw eligibility rule mismatch.
