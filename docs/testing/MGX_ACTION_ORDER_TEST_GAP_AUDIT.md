# MGX Action Order Test Gap Audit

Date: 2026-05-16

## Decision

`FALSE_ALARM_CONFIRMED_BY_HISTORY`

The Core 5 betting-order reality audit records every observed betting action with button, blind, actor, expected actor, folded/all-in seats, street contributions, and visible hero controls. The new browser audit passed for Badugi, D01, D02, S01, and S02 with no invalid actor rows and no hero-control mismatch rows.

Generated evidence:

- `reports/alpha/core5-action-order-audit.jsonl`
- `reports/alpha/core5-action-order-audit-summary.json`
- `reports/alpha/user-reported-bb-order-case.json`

## User-Reported BB Case

The observed BB actions were valid in the audited histories.

In pre-draw betting, BB acted only after earlier active obligations were resolved. In post-draw betting, BB can be the first valid actor when seats left of the button are folded or otherwise ineligible, because the rule is "first active left of BTN", not "always SB".

## Existing Test Gap

| Test | What it checked | Missing | Risk |
| --- | --- | --- | --- |
| `tests/e2e/core5-first-actor-order.spec.ts` | First actor and basic actor badge/control alignment | Did not emit every action with expected-vs-actual actor, contributions, and folded/all-in seats | A mid-street ordering bug could pass if the first actor was correct |
| Triple Draw first-actor tests | Variant mapping plus opening actor order | Did not prove every street action in a real browser hand | Could miss BB/SB acting early after folds or calls |
| Core 5 layout/interaction tests | Buttons are visible/tappable | Did not prove visible hero controls belonged to canonical actor | UI turn-sync bugs could look playable while actor was stale |
| One-hand controller tests | Controller hands complete | Did not write per-action order evidence | Completion alone could hide a legal-order violation |

## Added Coverage

| File | Purpose |
| --- | --- |
| `src/games/_core/audit/expectedBettingActor.js` | Shared expected first/next betting actor calculator for 3+ and HU, with folded/all-in skip |
| `src/games/_core/audit/actionOrderAuditLog.js` | Builds canonical action-order audit rows for browser traces |
| `src/games/_core/__tests__/expectedBettingActor.test.js` | Unit coverage for expected actor rules and position labels |
| `tests/e2e/core5-action-order-audit.spec.ts` | Browser action-history audit across Badugi/D01/D02/S01/S02 |

## Result

| Variant | Rows | Invalid actor rows | Hero control mismatch rows | Status |
| --- | ---: | ---: | ---: | --- |
| Badugi | 21 | 0 | 0 | PASS |
| D01 / 2-7TD | 11 | 0 | 0 | PASS |
| D02 / A-5TD | 12 | 0 | 0 | PASS |
| S01 / 2-7SD | 8 | 0 | 0 | PASS |
| S02 / A-5SD | 8 | 0 | 0 | PASS |

No `CORE5-ORDER-001` P0 is opened from this audit. Keep this action-history audit in the alpha gate because screenshots alone cannot distinguish a legal BB action after prior folds from a real order violation.
