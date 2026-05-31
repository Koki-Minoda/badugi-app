# MGX Major 10 Pro Step2 Report

Last updated: 2026-05-07

## Implemented Pro Strategies

| Variant | Family | Strategy File | Routing | Tests | Status | Notes |
| ------- | ------ | ------------- | ------- | ----- | ------ | ----- |
| D03 | Draw / Badugi | `badugiProStrategy.js` | Live in Badugi UI CPU draw/bet path via `chooseProAction` | PASS | READY | pat / 3-card draw-one / no-spew / value-bet guards live |
| D01 | Draw / 2-7 Triple Draw | `drawLowballProStrategy.js` | Live in draw controller `getCpuAction(..., { tierConfig })` | PASS | READY | pair discard / straight-flush break / final-round restraint |
| D02 | Draw / A-5 Triple Draw | `drawLowballProStrategy.js` | Live in draw controller `getCpuAction(..., { tierConfig })` | PASS | READY | wheel/6-low pat / pair discard / A-low handling |
| S01 | Draw / 2-7 Single Draw | `drawLowballProStrategy.js` | Live in draw controller `getCpuAction(..., { tierConfig })` | PASS | READY | single-draw cap / inherited 2-7 logic |
| S02 | Draw / A-5 Single Draw | `drawLowballProStrategy.js` | Live in draw controller `getCpuAction(..., { tierConfig })` | PASS | READY | single-draw cap / inherited A-5 logic |
| B01 | Holdem | `holdemProStrategy.js` | Safety fallback only | PASS | PARTIAL | returns `unsupported-pro-rules:holdem` until live heuristics exist |
| B05 | Omaha | `omahaProStrategy.js` | Safety fallback only | PASS | PARTIAL | returns `unsupported-pro-rules:omaha` |
| B06 | Omaha / Split | `splitPotProStrategy.js` | Safety fallback only | PASS | PARTIAL | Hi-Lo rules not implemented yet |
| ST1 | Stud | `studProStrategy.js` | Safety fallback only | PASS | PARTIAL | up-card / dead-card heuristics not live |
| ST3 | Razz | `studProStrategy.js` | Safety fallback only | PASS | PARTIAL | low-board / live-card heuristics not live |

## Pro Behavior Coverage

| Test ID | Behavior | Variant | Status | Notes |
| ------- | -------- | ------- | ------ | ----- |
| PRO-BADUGI-001 | made Badugi pats | D03 | PASS | no meaningless redraw |
| PRO-BADUGI-002 | strong 3-card Badugi draws one | D03 | PASS | legal 1-card redraw |
| PRO-BADUGI-003 | duplicate suit/rank discard priority | D03 | PASS | legal discard indexes only |
| PRO-BADUGI-004 | weak final hand does not over-raise | D03 | PASS | `CHECK` preferred when legal |
| PRO-BADUGI-005 | strong made hand may value bet | D03 | PASS | value raise/bet preserved |
| PRO-BADUGI-006 | all-in seat receives no betting action | D03 | PASS | no bet/raise/call for all-in actor |
| PRO-D01-001 | clean 7-low pats | D01 | PASS | strong pat logic |
| PRO-D01-002 | pair discard | D01 | PASS | duplicate rank broken first |
| PRO-D01-003 | high-card discard | D01 | PASS | rough highs trimmed first |
| PRO-D01-004 | straight/flush penalty awareness | D01 | PASS | penalty structure broken |
| PRO-D01-005 | fixed-limit raise cap respected | D01 | PASS | no invented raise outside legalActions |
| PRO-D02-001 | wheel pats | D02 | PASS | wheel treated as made |
| PRO-D02-002 | ace treated as low | D02 | PASS | 6-low pats correctly |
| PRO-D02-003 | pair discard | D02 | PASS | duplicate Ace or pair broken |
| PRO-D02-004 | straight/flush not over-penalized | D02 | PASS | A-5 keeps strong clean lows |
| PRO-D02-005 | strong A-5 low may value bet | D02 | PASS | value raise live |
| PRO-S01-001 | single draw only | S01 | PASS | draw count constrained |
| PRO-S01-002 | inherits 2-7 logic | S01 | PASS | pair discard logic reused |
| PRO-S02-001 | single draw only | S02 | PASS | draw count constrained |
| PRO-S02-002 | inherits A-5 logic | S02 | PASS | A-low pat logic reused |
| PRO-SD-001 | final betting no reckless raise | S01/S02 | PASS | weak final hand restrained |
| PRO-ROUTE-001 | tier=pro calls overlay | D01 | PASS | controller metadata marks `pro-overlay` |
| PRO-ROUTE-002 | missing pro model falls back safely | B01 | PASS | safe fallback with unsupported reason |
| PRO-ROUTE-003 | standard/pro routes distinguishable | D01 | PASS | metadata `ruleBasedD01` vs `pro-d01` |
| PRO-ROUTE-004 | illegal ONNX action blocked | D03 | PASS | blocked action recorded |
| PRO-ROUTE-005 | fallback reason recorded | B05 | PASS | warning and reason preserved |

## Pro vs Standard Sanity

| Scenario | Standard | Pro | Expected Improvement | Status |
| -------- | -------- | --- | -------------------- | ------ |
| D01 paired lowball draw | generic discard | pair-aware discard | duplicate rank is broken first | PASS |
| D01 clean 7-low draw | may rely on generic fallback | pat | strong made low is preserved | PASS |
| D02 wheel draw | may rely on generic fallback | pat | wheel is never broken | PASS |
| D03 weak final betting hand | can bluff/raise via generic policy | check/call restraint | obvious spew reduced | PASS |
| Unsupported family Pro request | generic safe fallback | safe fallback + unsupported reason | missing implementation is explicit | PASS |

## Major 10 Remaining Gaps

| Variant | Gap | Severity | Required Next Step |
| ------- | --- | -------- | ------------------ |
| B01 | `NEEDS_PRO_RULES` | Medium | add preflop/postflop Pro heuristics and runtime connection |
| B05 | `NEEDS_PRO_RULES` | Medium | add nut-draw / 2-card-use PLO overlay rules |
| B06 | `NEEDS_PRO_RULES` | Medium | add low eligibility / quartering safeguards |
| ST1 | `NEEDS_PRO_RULES` | Medium | add bring-in / board / dead-card heuristics |
| ST3 | `NEEDS_PRO_RULES` | Medium | add live-low board heuristics and pressure rules |
| B01/B05/B06/ST1/ST3 | `NEEDS_UI_CONNECTION` | Medium | connect family Pro overlay into board/stud live CPU path |
| Major 10 non-draw families | `NEEDS_OBSERVATION` | Low | promote explicit Pro fixtures around board/stud observation semantics |
| Full-suite `npm test` | Existing unrelated timeout | Low | fix `HandHistoryScreen.test.jsx` timeout before using as hard release gate |
