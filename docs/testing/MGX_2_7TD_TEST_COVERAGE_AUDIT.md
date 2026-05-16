# MGX 2-7 Triple Draw Test Coverage Audit

Date: 2026-05-16

Scope: `D01` / `deuce_to_seven_triple_draw`.

| Risk | Existing Test | Covered? | Gap | New Test Needed |
| --- | --- | --- | --- | --- |
| 6max pre-draw first actor | `tripleDrawFirstActorRegression.test.js`, `twoSevenTDBettingOrderSpec.test.js` | Yes | None for focused engine path. | Keep in alpha gate. |
| 3way pre-draw first actor | `twoSevenTDBettingOrderSpec.test.js` | Yes | None for focused engine path. | Keep focused test. |
| HU pre-draw first actor | `tripleDrawFirstActorRegression.test.js`, `twoSevenTDBettingOrderSpec.test.js` | Yes | None. | Keep focused test. |
| Post-draw first actor | `twoSevenTDBettingOrderSpec.test.js` | Yes | Browser evidence is broader only. | Add long-run if needed. |
| Folded/all-in skip | `twoSevenTDBettingOrderSpec.test.js` | Yes | None focused. | Keep focused test. |
| Full 3-draw progression | `twoSevenTDProgressionSpec.test.js`, `two-seven-td-progression-spec.spec.ts` | Yes | Long-run multi-hand D01 path remains optional. | Add later if D01 becomes alpha candidate. |
| Check-around progression | `twoSevenTDProgressionSpec.test.js` | Yes | None focused. | Keep focused test. |
| Bet/call progression | `twoSevenTDProgressionSpec.test.js` | Yes | None focused. | Keep focused test. |
| Raise/cap progression | Existing D01 controller/engine tests plus focused audit | Partial | Raise cap has unit evidence but not full browser path. | Add if D01 moves to alpha playable. |
| Fold to single winner | `twoSevenTDShowdownNextHandSpec.test.js` | Yes | None focused. | Keep focused test. |
| All-in progression | Existing draw family and safety tests; `twoSevenTDProgressionSpec.test.js` expected-fail | Partial | Current engine can elect an all-in seat as a draw actor, contrary to the Step2 spec. Deep side-pot browser path is also not covered in this Step2 audit. | Fix draw eligibility or revise spec, then convert expected-fail to normal pass and add side-pot release gate. |
| No-next-alive | `twoSevenTDProgressionSpec.test.js` expected-fail | Partial | Current no-next-alive all-in path transitions to draw and selects the all-in seat. | Resolve `27TD-PROG-001` before D01 release. |
| Pot continuity | `twoSevenTDPotContinuitySpec.test.js`, E2E focused spec | Yes | Deep all-in side pot not covered here. | Add side-pot gate before release. |
| Side pot | Existing core side-pot tests | Partial | D01-specific multiway all-in browser proof missing. | Needed before D01 alpha release. |
| 0-card pat | `twoSevenTDDrawRoundSpec.test.js` | Yes | None. | Keep focused test. |
| 1-5 card draw | `twoSevenTDDrawRoundSpec.test.js` | Yes | None. | Keep focused test. |
| Invalid draw count rejected | `twoSevenTDDrawRoundSpec.test.js` | Yes | None. | Keep focused test. |
| Evaluator ace high | `twoSevenTDEvaluatorSpec.test.js` | Yes | None. | Keep focused test. |
| Evaluator straight bad | `twoSevenTDEvaluatorSpec.test.js` | Yes | None. | Keep focused test. |
| Evaluator flush bad | `twoSevenTDEvaluatorSpec.test.js` | Yes | None. | Keep focused test. |
| Pair bad | `twoSevenTDEvaluatorSpec.test.js` | Yes | None. | Keep focused test. |
| Showdown | `twoSevenTDShowdownNextHandSpec.test.js` | Yes | None focused. | Keep focused test. |
| Next hand | `twoSevenTDShowdownNextHandSpec.test.js` | Yes | None focused. | Keep focused test. |
| UI snapshot merge | `twoSevenTDSnapshotMergeSpec.test.jsx` | Yes | None focused. | Keep focused test. |
| Stale actingPlayerIndex | `twoSevenTDSnapshotMergeSpec.test.jsx` | Yes | None focused. | Keep focused test. |
| Hero action bar consistency | `twoSevenTDSnapshotMergeSpec.test.jsx`, browser focused spec | Yes | No release-wide manual evidence. | Recheck if D01 is exposed. |
| Browser E2E | `two-seven-td-progression-spec.spec.ts` | Yes | Single focused hand only. | Add multi-hand D01 gate before alpha playable. |
| Mobile progression | Existing triple-draw mobile actor/layout specs | Recorded only | Layout is intentionally out of Step2 scope. | Handle in Step5. |

## Conclusion

Focused 2-7TD mapping, evaluator, non-all-in progression, pot continuity, and UI snapshot coverage is sufficient for this audit. D01 should not be promoted or made alpha-playable from this result because `27TD-PROG-001` is an open rule mismatch and D01 still lacks deeper all-in side-pot and long-run browser release evidence.
