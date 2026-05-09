# MGX Pro Step4-U Counterfactual Replay Report

Source artifacts:
- `reports/ai-eval/divergence-replay-samples/d02-20260506.jsonl`
- `reports/ai-eval/divergence-replay-samples/d02-20260507.jsonl`
- `reports/ai-eval/divergence-replay-samples/d02-20260508.jsonl`
- `reports/ai-eval/divergence-replay-samples/s01-20260506.jsonl`
- `reports/ai-eval/divergence-replay-samples/s01-20260507.jsonl`
- `reports/ai-eval/divergence-replay-samples/s01-20260508.jsonl`
- `reports/ai-eval/divergence-replay-samples/s02-20260506.jsonl`
- `reports/ai-eval/divergence-replay-samples/s02-20260507.jsonl`
- `reports/ai-eval/divergence-replay-samples/s02-20260508.jsonl`
- `reports/ai-eval/counterfactual-score-s02-s01-d02.json`

## Summary

| Item | Result |
| ---- | ------ |
| Replay samples | `27` |
| Valid replays | `54` |
| Invalid replays | `0` |
| Clear Standard better buckets | `5` |
| Clear Pro better buckets | `0` |
| No clear edge buckets | `1` |

Counterfactual replay confirms that the next Pro work should come from same-state action comparison, not from observational seat-delta alone. The current replay set finds no bucket where Pro is clearly better than Standard, and it also shows that not every high-frequency `FOLD vs CALL` divergence is worth reverting.

## Bucket Results

| Variant | Bucket | Pro Action | Standard Action | Pro EV | Standard EV | Delta | Verdict | Suggested Next |
| ------- | ------ | ---------- | --------------- | -----: | ----------: | ----: | ------- | -------------- |
| D02 | `strongA5 second-pressure` | `FOLD` | `RAISE` | 0.0 | 200.0 | -200.0 | `STANDARD_BETTER` | Add a narrow replay-backed exception for top `strongA5` second-pressure spots before touching any trash defense. |
| S02 | `strongSDA5 CALL/FOLD/RAISE` | `FOLD` | `RAISE` | 0.0 | 140.0 | -140.0 | `STANDARD_BETTER` | Test a very small `strongSDA5` post-draw pressure raise/call retention bucket. |
| S01 | `strongSD27 top-end pressure` | `FOLD` | `CALL` | 0.0 | 33.33 | -33.33 | `STANDARD_BETTER` | Revisit top-end `strongSD27` pressure retention only, not the full S01 guard. |
| S01 | `upperMediumSD27 small-pressure` | `FOLD` | `CALL` | 0.0 | 26.67 | -26.67 | `NEEDS_MORE_SAMPLES` | Keep as a candidate, but do not ship a heuristic without more replay volume. |
| S02 | `trashSDA5 FOLD/CALL verify` | `FOLD` | `CALL` | 0.0 | 14.0 | -14.0 | `STANDARD_BETTER` | Verification only. Do not reopen weak/trash defense from this sparse bucket alone. |
| D02 | `trashA5 FOLD/CALL verify` | `FOLD` | `CALL` | 0.0 | 8.67 | -8.67 | `STANDARD_BETTER` | Verification only. This is still too noisy to justify reopening D02 trash defense. |
| S01 | `trashSD27 FOLD/CALL verify` | `FOLD` | `CALL` | 0.0 | 1.33 | -1.33 | `NO_CLEAR_EDGE` | Leave the S01 guard intact. |
| S02 | `premiumSDA5 CALL/RAISE` | `CALL` | `RAISE` | 120.0 | 120.0 | 0.0 | `NEEDS_MORE_SAMPLES` | Gather more samples before changing premium S02 pressure behavior. |
| S02 | `strongSDA5 CALL/FOLD/RAISE` | `CALL` | `RAISE` | 30.0 | 30.0 | 0.0 | `NEEDS_MORE_SAMPLES` | Gather more samples before widening the strong S02 line. |

## Actionable Fix Candidates

| Priority | Variant | Spot | Suggested Fix | Confidence | Risk |
| -------- | ------- | ---- | ------------- | ---------- | ---- |
| P0 | D02 | `strongA5 second-pressure` | Add a replay-backed exception that keeps top `strongA5` alive under specific second-pressure profiles. | Medium | Medium |
| P0 | S02 | `strongSDA5 CALL/FOLD/RAISE` | Add a narrow post-draw `CALL/RAISE` retention rule in safe pressure spots only. | Medium | Medium |
| P1 | S01 | `strongSD27 top-end pressure` | Add a tiny top-end pressure retention bucket and validate with longer replay samples. | Medium | Low |
| P1 | S01 | `upperMediumSD27 small-pressure` | Expand only if replay volume increases and the edge survives. | Low | Medium |

## Do Not Touch

| Variant | Spot | Reason |
| ------- | ---- | ------ |
| S02 | `trashSDA5 FOLD/CALL verify` | Replay still shows a Standard edge in a tiny sample, but this bucket was previously a structural leak. Reopening it risks reinstating the old weak/trash inheritance bug. |
| D02 | `trashA5 FOLD/CALL verify` | Same issue as S02. Observationally frequent, replay-backed edge still sparse, and previous D02 trims show this area is unstable. |
| S01 | `trashSD27 FOLD/CALL verify` | Counterfactual result is effectively neutral. The existing S01 guard should stay frozen. |

## Outcome

Step4-U provides the missing bridge from observational divergence to replay-backed decision quality. The safe conclusion is that the remaining Pro work should focus on sparse good-hand buckets with same-state evidence, while weak/trash defense stays locked down until counterfactual volume is much larger.
