# MGX 2-7 Triple Draw Release Readiness

Date: 2026-05-16

Scope: `D01` / `deuce_to_seven_triple_draw`.

## Decision

`2_7TD_BLOCKED_BY_RULE_BUG`

2-7 Triple Draw is not promoted, not routed, and not newly exposed for friend alpha by this audit.

## Gate Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| Variant mapping | PASS | `D01` maps to `deuce_to_seven_triple_draw`; `D02` is A-5 Triple Draw, not 2-7TD. |
| Display / engine alignment | PASS | Engine display name is `2-7 Triple Draw`, `variantId="D01"`, `lowType="27"`. |
| Draw count | PASS | `maxDrawRounds=3`; focused tests reject a fourth draw. |
| Hand size | PASS | `handCardCount=5`; focused tests verify 5-card initial hands. |
| 2-7 evaluator | PASS | Ace high, straight bad, flush bad, pair bad, and 7-5-4-3-2 best-low fixtures pass. |
| Betting order | PASS | 6max/3way pre-draw actor starts left of BB; HU starts BTN/SB; post-draw starts left of button. |
| Pot continuity | PASS | Focused unit tests keep pot/invested value through draw/bet transitions. |
| UI snapshot actor merge | PASS | Canonical `turn`/`nextTurn` wins over stale metadata. |
| Browser focused progression | PASS/PENDING | Focused E2E exists for a single D01 hand; long-run D01 all-in release proof is not part of this Step2 audit. |
| All-in draw skip | FAIL | `27TD-PROG-001`: all-in seats can be selected as draw actors, contrary to the Step2 spec. |
| Side-pot release evidence | WARN | D01-specific all-in side-pot browser gate is still missing. |

## Release Blockers

| ID | Priority | Title | Status | Required Fix |
| --- | --- | --- | --- | --- |
| `27TD-PROG-001` | P1 | All-in player can be elected as draw actor | OPEN | Update D01 draw eligibility to skip all-in seats, or explicitly revise the rule spec, then convert the expected-fail regression into a passing test. |
| `27TD-PROG-002` | P2 | Missing D01 all-in side-pot browser release gate | OPEN | Add a D01 multiway all-in/side-pot browser gate before exposing D01 beyond preview. |

## Availability

D01 remains preview-only / audit-only. This Step2 audit does not change friend-alpha scope, production routing, model registry, RL routing, or Iron promotion state.

