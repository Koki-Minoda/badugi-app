# MGX A-5 Triple Draw Test Coverage Audit

Date: 2026-05-16

Scope: `D02` / `ace_to_five_triple_draw`.

## Coverage Matrix

| Risk | Existing / Added Test | Covered? | Gap | New Test Needed |
| --- | --- | --- | --- | --- |
| 6max pre-draw first actor | `a5TDBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| 3way pre-draw first actor | `a5TDBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| HU pre-draw first actor | `a5TDBettingOrderSpec.test.js` | Yes | None for focused actor order. | No |
| Post-draw first actor | `a5TDBettingOrderSpec.test.js` | Yes | None for folded/all-in betting skip. | No |
| Full 3 draw progression | `a5TDProgressionSpec.test.js`; `a5-td-progression-spec.spec.ts` | Yes | Browser coverage is focused one-hand, not long-run. | Long-run release gate later |
| Check-around progression | `a5TDProgressionSpec.test.js` | Yes | None for focused HU path. | No |
| Bet/call progression | `a5TDProgressionSpec.test.js` | Yes | None for focused opening call/check closure. | No |
| Raise/cap progression | Existing shared draw-lowball tests | Partial | D02-specific raise-cap edge coverage is not exhaustive. | Add if alpha exposes fixed-limit raise UX |
| Fold to single winner | `a5TDProgressionSpec.test.js`; `a5TDShowdownNextHandSpec.test.js` | Yes | None for focused fold-to-one. | No |
| All-in progression | `a5TDProgressionSpec.test.js` expected-fail | No | All-in draw skip does not meet Step3 spec. | Convert expected-fail after fix/spec decision |
| No-next-alive | `a5TDProgressionSpec.test.js` expected-fail | No | Same inherited all-in draw actor risk. | Convert expected-fail after fix/spec decision |
| Pot continuity through transitions | `a5TDPotContinuitySpec.test.js` | Yes | Browser all-in side-pot proof missing. | Add side-pot browser release gate later |
| Side pot | Shared all-in tests | Partial | No D02-specific browser side-pot release gate. | Yes |
| 0-card pat | `a5TDDrawRoundSpec.test.js` | Yes | None. | No |
| 1-5 card draw | `a5TDDrawRoundSpec.test.js` | Yes | None for focused action validation. | No |
| Invalid draw count rejected | `a5TDDrawRoundSpec.test.js` | Yes | None. | No |
| Evaluator: ace low | `a5TDEvaluatorSpec.test.js` | Yes | None. | No |
| Evaluator: A-2-3-4-5 best | `a5TDEvaluatorSpec.test.js` | Yes | None. | No |
| Evaluator: straight ignored | `a5TDEvaluatorSpec.test.js` | Yes | None. | No |
| Evaluator: flush ignored | `a5TDEvaluatorSpec.test.js` | Yes | None. | No |
| Evaluator: pair bad | `a5TDEvaluatorSpec.test.js` | Yes | None. | No |
| Showdown | `a5TDShowdownNextHandSpec.test.js` | Yes | None for focused showdown path. | No |
| Next hand | `a5TDShowdownNextHandSpec.test.js` | Yes | None for focused next-hand reset. | No |
| UI snapshot merge | `a5TDSnapshotMergeSpec.test.jsx` | Yes | None for canonical actor over stale metadata. | No |
| Stale actingPlayerIndex | `a5TDSnapshotMergeSpec.test.jsx` | Yes | None. | No |
| Hero action bar consistency | `a5TDSnapshotMergeSpec.test.jsx`; E2E focused path | Yes | Browser actor badge consistency only covered in focused path. | Broaden in Step5 UI audit if needed |
| Browser E2E | `a5-td-progression-spec.spec.ts` | Yes | Focused one-hand only. | Add long-run if D02 has manual concerns |
| Mobile progression | Existing alpha mobile tests | Recorded only | Step3 excludes layout/mobile fixes. | Step5 UI/layout audit |

## Conclusion

The A-5TD focused rule/evaluator/progression coverage is now explicit. Release readiness remains blocked by an all-in draw eligibility mismatch and incomplete D02-specific side-pot release evidence.
