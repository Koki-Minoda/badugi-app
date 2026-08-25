# MGX Pro Step4-E D02 Call Analysis

Scope:
- `reports/ai-eval/pro-vs-standard-20260506-d02-100-step4e.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-100-step4e.json`
- `reports/ai-eval/pro-vs-standard-20260508-d02-100-step4e.json`
- `reports/ai-eval/pro-vs-standard-20260506-d02-300-step4e.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300-step4e.json`

Summary:
- Step4-E removed all observed `weakA5` and `trashA5` calls in the sampled D02 runs.
- Remaining D02 call volume is concentrated in `premiumA5` and `strongA5`.
- The main surviving leak is no longer weak-hand defense. It is `strongA5` bluff-catch behavior against repeated facing bets.

## Call Leak Breakdown

| Leak | Count | EV Impact | Street | Hand Class | Facing Action | Current Pro Action | Suggested Fix |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| `strongA5` medium-bet defense still loses too often | 6 calls, 4 losing | `-540` on losing samples, `-20` net | Early + mid draw betting, some final | `strongA5` | `CALL` vs medium bet after pressure continues | Keeps calling because `strongA5` is still allowed to defend medium bets | Tighten repeat-call logic. Once `strongA5` has already faced pressure on earlier streets, fold more often unless the price stays minimal. |
| `strongA5` large-bet defense is pure loss | 2 calls, 2 losing | `-270` | Early draw betting | `strongA5` | `CALL` vs large bet | Rare but still present in large-bet spots with low/no pot context | Treat `strongA5` like `mediumA5` when `betSizeBucket=large`, especially before a pot is established. |
| `premiumA5` blind pre-draw calls can still whiff | 7 calls, 1 losing | `-200` on losing sample, `+2390` net | Early draw betting | `premiumA5` | `CALL` vs large/small open pressure | Continues widely with wheel/6-low class because the aggregate EV is strong | Keep this. Only consider a narrow pre-draw cap when pot is undefined and the same seat has already paid once. |
| `premiumA5` final small-bet bluff-catch is mostly fine | 8 calls, 1 losing | `-200` on losing sample, `+4140` net | Final betting | `premiumA5` | `CALL` vs small bet | Continues as intended and still wins overall | Keep current rule. No immediate reduction needed. |
| `weakA5` / `trashA5` facing-bet defense removed | 0 calls observed | Prevented leak class | All streets | `weakA5`, `trashA5` | Facing bet | Folds/checks instead of bluff-catching | Maintain current policy. This is the main Step4-E success. |

## Example Losing Traces

| Leak | Example Trace | Notes |
| --- | --- | --- |
| `strongA5` medium-bet chain | `seed=20260507 hand=189 drawRound=0/1/2 hand=2S 3C 5H 7D 4D calls 10, 20, 40 and finishes seatDelta=-110` | Smooth `7-low` kept defending across multiple streets and bled one full losing sequence. |
| `strongA5` large-then-medium chain | `seed=20260507 hand=297 drawRound=0/1/2 hand=7C 4C 3S 2H 5D calls 20, 20, 40 and finishes seatDelta=-160` | Same pattern: strong but non-premium A-5 keeps bluff-catching too long. |
| `premiumA5` rare losing call | `seed=20260507 hand=197 hand=2S AC 5H 6S 4C large pre-draw call and final small call, seatDelta=-200` | Premium A-5 calls remain profitable overall, so this is not the primary leak bucket. |

## Step4-E Takeaway

Step4-E succeeded at the requested task:
- `CALL losing call` from `weakA5` / `trashA5` was effectively removed from the sample.
- `facing bet leak` shifted upward into `strongA5`, not weak hands.

The next D02 improvement should be narrower than Step4-E:
- reduce repeated `strongA5` calls after pressure persists,
- fold `strongA5` more often when `betSizeBucket=large`,
- keep `premiumA5` call permission mostly intact because its aggregate EV is still positive.
