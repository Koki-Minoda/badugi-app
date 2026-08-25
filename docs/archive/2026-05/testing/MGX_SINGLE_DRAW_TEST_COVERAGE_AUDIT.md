# MGX Single Draw Test Coverage Audit

Date: 2026-05-16

Scope: `S01` / `deuce_to_seven_single_draw` and `S02` / `ace_to_five_single_draw`.

## Coverage Matrix

| Risk | Existing / Added Test | Covered? | Gap | New Test Needed |
| --- | --- | --- | --- | --- |
| 6max pre-draw first actor | `singleDrawBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| 3way pre-draw first actor | `singleDrawBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| HU pre-draw first actor | `singleDrawBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| Post-draw first actor | `singleDrawBettingOrderSpec.test.js` | Yes | None for folded/all-in betting skip. | No |
| Full 1 draw progression | `singleDrawProgressionSpec.test.js`; `single-draw-progression-spec.spec.ts` | Yes | Browser coverage is focused one-hand, not long-run. | Long-run release gate later |
| No second draw | `singleDrawRoundSpec.test.js`; E2E | Yes | None for focused max draw check. | No |
| Check-around progression | `singleDrawProgressionSpec.test.js` | Yes | None for focused HU path. | No |
| Bet/call progression | `singleDrawProgressionSpec.test.js` | Yes | None for focused opening call/check closure. | No |
| Raise/cap progression | Existing shared draw-lowball tests | Partial | S01/S02-specific raise-cap edge coverage is not exhaustive. | Add if alpha exposes fixed-limit raise UX |
| Fold to single winner | `singleDrawProgressionSpec.test.js`; `singleDrawShowdownNextHandSpec.test.js` | Yes | None for focused fold-to-one. | No |
| All-in progression | `singleDrawProgressionSpec.test.js` expected-fail | No | All-in draw skip does not meet Step4 spec. | Convert expected-fail after fix/spec decision |
| No-next-alive | `singleDrawProgressionSpec.test.js` expected-fail | No | Same inherited all-in draw actor risk. | Convert expected-fail after fix/spec decision |
| Pot continuity through transition | `singleDrawPotContinuitySpec.test.js` | Partial | Canonical `snapshot.pot` is still `0` immediately after blind posting and next-hand reset; transition tests preserve that value, but the Step4 spec requires a nonzero active pot after blinds. | Resolve `SD-POT-001`, then convert expected-fail pot tests |
| Side pot | Shared all-in tests | Partial | No S01/S02-specific browser side-pot release gate. | Yes |
| 0-card pat | `singleDrawRoundSpec.test.js` | Yes | None. | No |
| 1-5 card draw | `singleDrawRoundSpec.test.js` | Yes | None for focused action validation. | No |
| Invalid draw count rejected | `singleDrawRoundSpec.test.js` | Yes | None. | No |
| 2-7 evaluator: ace high | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| 2-7 evaluator: straight bad | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| 2-7 evaluator: flush bad | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| A-5 evaluator: ace low | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| A-5 evaluator: straight ignored | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| A-5 evaluator: flush ignored | `singleDrawEvaluatorSpec.test.js` | Yes | None. | No |
| Showdown | `singleDrawShowdownNextHandSpec.test.js` | Yes | None for focused showdown path. | No |
| Next hand | `singleDrawShowdownNextHandSpec.test.js` | Yes | None for focused next-hand reset. | No |
| UI snapshot merge | `singleDrawSnapshotMergeSpec.test.jsx` | Yes | None for canonical actor over stale metadata. | No |
| Stale actingPlayerIndex | `singleDrawSnapshotMergeSpec.test.jsx` | Yes | None. | No |
| Hero action bar consistency | `singleDrawSnapshotMergeSpec.test.jsx`; E2E focused path | Yes | Browser actor badge consistency only covered in focused path. | Broaden in Step5 UI audit if needed |
| Browser E2E | `single-draw-progression-spec.spec.ts` | Yes | Focused one-hand only. | Add long-run if S01/S02 have manual concerns |
| Mobile progression | Existing alpha mobile tests | Recorded only | Step4 excludes layout/mobile fixes. | Step5 UI/layout audit |

## Conclusion

The Single Draw focused rule/evaluator/progression coverage is now explicit. Release readiness remains blocked by canonical snapshot pot semantics after blinds, an all-in draw eligibility mismatch, and incomplete S01/S02-specific side-pot release evidence.
