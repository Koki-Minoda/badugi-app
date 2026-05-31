# MGX Pro Step4-V Counterfactual Fix Report

Source artifact:
- `reports/ai-eval/counterfactual-score-d02-s02-s01.json`

Step4-V touched only the replay-backed `STANDARD_BETTER` strong-hand buckets from Step4-U.

| Bucket | Before Action | After Action | Before Delta | After Delta | Aggregate Impact | Decision |
| ------ | ------------- | ------------ | -----------: | ----------: | ---------------: | -------- |
| `D02 strongA5 second-pressure` | `FOLD` | allow `RAISE/CALL` in safe second-pressure windows | -200.00 | -200.00 | targeted gap held at `-6.8`, full-suite gap held at `-11.5` | Keep the narrow live exception, but expand replay samples before widening further. |
| `S02 strongSDA5 CALL/FOLD/RAISE` | `FOLD` | allow `RAISE/CALL` in safe `HU/3way` small pressure | -140.00 | -140.00 | targeted gap held at `-12.09`, full-suite gap held at `-20.27` | Keep the narrow live exception, but the replay bucket still needs more volume. |
| `S01 strongSD27 top-end pressure` | `FOLD` | keep `CALL` under safe small/medium pressure | -33.33 | -33.33 | targeted gap held at `-11.09`, full-suite gap held at `-14.0` | Keep the live retention, but do not expand to lower-quality medium buckets. |

## Interpretation

- Step4-V did not create a new replay winner bucket yet.
- The live aggregate did not worsen, which means the narrow strong-hand exceptions are at least safe under the current suite.
- The remaining blocker is replay sample depth: the current corpus still records the original divergent action pair for each bucket, so bucket-level counterfactual deltas stay unchanged until a larger refreshed replay set is collected.
