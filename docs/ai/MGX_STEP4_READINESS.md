# MGX Step4 Readiness

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4v.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4v.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4v.json`
- `reports/ai-eval/pro-vs-standard-20260506-step4v-targeted.json`
- `reports/ai-eval/pro-vs-standard-20260507-step4v-targeted.json`
- `reports/ai-eval/pro-vs-standard-20260508-step4v-targeted.json`
- `reports/ai-eval/counterfactual-score-s02-s01-d02.json`
- `reports/ai-eval/counterfactual-score-d02-s01.json`
- `docs/ai/MGX_PRO_STEP4W_COUNTERFACTUAL_CORPUS_REPORT.md`
- `docs/ai/MGX_PRO_STEP4X_REPORT.md`
- `docs/ai/MGX_PRO_STEP4X_STABLE_BUCKET_FIXES.md`

## Average EV Summary

| Variant | Avg Pro EV | Avg Standard EV | EV Gap | Fallback Avg | Safety | Verdict |
| ------- | ---------: | --------------: | -----: | -----------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | 13.9 | 16.1 | -2.1 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | 8.0 | 22.0 | -14.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S02 | 4.9 | 25.1 | -20.3 | 0.0000 | PASS | IMPROVED_NOT_READY |

## Readiness Gates

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Avg Pro EV >= Avg Standard EV on D03/D01/D02/S01/S02 | FAIL | Step4-V keeps `fallback=0`, but `D02`, `S01`, and `S02` still remain below Standard on the full 3-seed suite. |
| Fallback < 30% on all target variants | PASS | `D03`, `D01`, `D02`, `S01`, and `S02` are all now at `0.0000`. |
| Safety stable (`illegal`, `freeze`, `EV fail` all zero) | PASS | Every executed target variant stayed at `0` on all 3 seeds. |
| Pro overlay is actually deciding actions | PASS | `D03` is fully overlay-driven and the lowball variants remain mostly overlay-driven while fallback stays sub-`0.30`. |
| Leak cause is identifiable | PASS | [MGX_PRO_STEP4O_D01_LEAK_DEEPDIVE.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4O_D01_LEAK_DEEPDIVE.md), [MGX_PRO_STEP4P_S01_CALL_INHERITANCE_DEEPDIVE.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4P_S01_CALL_INHERITANCE_DEEPDIVE.md), [MGX_PRO_STEP4Q_S02_RESIDUAL_VALUE_DEEPDIVE.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4Q_S02_RESIDUAL_VALUE_DEEPDIVE.md), [MGX_PRO_STEP4U_COUNTERFACTUAL_REPLAY_REPORT.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4U_COUNTERFACTUAL_REPLAY_REPORT.md), [MGX_PRO_STEP4V_COUNTERFACTUAL_FIX_REPORT.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4V_COUNTERFACTUAL_FIX_REPORT.md), and [MGX_PRO_STEP4W_COUNTERFACTUAL_CORPUS_REPORT.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4W_COUNTERFACTUAL_CORPUS_REPORT.md) now separate stable replay-backed buckets from noisy buckets. |

## Verdict

`NO`

Step4-X confirms that the Step4-W stable buckets were safe to touch, but the required full-suite averages do not move yet. `S01` improves slightly in targeted `500-hand` runs, `D02` does not, and the historical counterfactual bucket deltas remain effectively unchanged until a fresh post-patch replay corpus is generated. Iron readiness is still blocked by EV quality on `D02`, `S01`, and `S02`.

Step4-Z applies the last fresh-corpus-backed heuristic (`D02 strongA5 second-pressure`) on fresh seeds `20260509/10/11`. Safety stays perfect and fallback remains `0.0000`, but D02 does not improve. This is the stopping point for manual Pro heuristics.

## Experimental Iron Readiness

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Every target gap is `>= -10` | FAIL | `D01` clears the experimental threshold at `-2.1`, `D02` is still `-11.5`, `S01` is `-14.0`, and `S02` is still `-20.3`. |
| Safety stable (`illegal`, `freeze`, `EV fail` all zero) | PASS | All target variants remain at `0` across the refreshed 3-seed suite. |
| Fallback within target | PASS | All target variants remain below `0.30`; `D03`, `D01`, `D02`, `S01`, and `S02` are all at `0.0000`. |
| Teacher-quality Pro for Iron bootstrap | FAIL | `D01` is nearly neutral and Step4-V preserves all safety gates, but `S02`, `S01`, and `D02` still need material EV-gap compression before Pro is teacher-quality for Iron bootstrap. |

`READY_FOR_IRON_EXPERIMENTAL = NO`


## Step4-Y Dataset Status

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Fresh post-patch corpus collected | PASS | Step4-Y fresh corpus (`500 hand x 3 seed`, `D02,S01,S02`) and action-value export completed; dataset valid rows: `71`. |
| Action-value dataset available | PASS | Audit is recorded in [MGX_ACTION_VALUE_DATASET_AUDIT.md](/home/mgx/badugi-app/docs/ai/MGX_ACTION_VALUE_DATASET_AUDIT.md). |
## Required Next Work

| Priority | Variant | Required Fix |
| -------- | ------- | ------------ |
| P0 | Iron bootstrap | Use [MGX_IRON_BOOTSTRAP_DATASET_CANDIDATE.md](/home/mgx/badugi-app/docs/ai/MGX_IRON_BOOTSTRAP_DATASET_CANDIDATE.md) and the Step4-Y action-value export as the supervised warm-start source. |
| P0 | S01/S02 | Fresh corpus still leaves S01/S02 buckets noisy or under-sampled. Prefer replay corpus expansion or Iron bootstrap dataset work over another manual heuristic pass. |
| P1 | D01 | Keep the Step4-O late-defense trim intact; only small smooth `8-low` value refinements remain if D01 is revisited. |
| P1 | D03 | Move from neutral to positive EV by tuning medium made Badugi bets and cheap-call defense. |
