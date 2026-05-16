# MGX A-5 Triple Draw Release Readiness

Date: 2026-05-16

Scope: `D02` / `ace_to_five_triple_draw`.

## Decision

`A5TD_BLOCKED_BY_RULE_BUG`

A-5 Triple Draw is not promoted, not rerouted, and not newly exposed by this audit. The current variant gate state is unchanged.

## Gate Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| Variant mapping | PASS | `D02` maps to `ace_to_five_triple_draw`; `S02` is A-5 Single Draw, not A-5TD. |
| Display / engine alignment | PASS | Engine display name is `A-5 Triple Draw`, `variantId="D02"`, `lowType="A5"`. |
| Draw count | PASS | Triple-draw path has 3 draw rounds; focused tests reject a fourth draw. |
| Hand size | PASS | 5-card initial hands verified by focused tests. |
| A-5 evaluator | PASS | Ace low, A-2-3-4-5 best, straight ignored, flush ignored, pair bad fixtures pass. |
| Betting order | PASS | 6max/3way pre-draw actor starts left of BB; HU starts BTN/SB; post-draw starts left of button. |
| Pot continuity | PASS | Focused tests keep pot/invested value through draw/bet transitions. |
| UI snapshot actor merge | PASS | Canonical `turn`/`nextTurn` wins over stale metadata. |
| Browser focused progression | PASS | Focused A-5TD browser E2E reaches hand result and prevents a fourth draw. |
| All-in draw skip | FAIL | `A5TD-PROG-001`: all-in seats can be elected as draw actors, contrary to the Step3 spec. |
| Side-pot release evidence | WARN | D02-specific all-in side-pot browser gate is still missing. |

## Release Blockers

| ID | Priority | Title | Status | Required Fix |
| --- | --- | --- | --- | --- |
| `A5TD-PROG-001` | P1 | All-in player can be elected as draw actor | OPEN | Update inherited triple-draw draw eligibility to skip all-in seats, or explicitly revise the rule spec, then convert the expected-fail regression into a passing test. |
| `A5TD-PROG-002` | P2 | Missing D02 all-in side-pot browser release gate | OPEN | Add a D02 multiway all-in/side-pot browser gate before final friend-alpha release confidence. |

## Availability

D02 availability is not changed by this Step3 audit. The audit records that D02 has correct mapping and evaluator separation, but release readiness remains blocked by the all-in draw eligibility rule mismatch.
