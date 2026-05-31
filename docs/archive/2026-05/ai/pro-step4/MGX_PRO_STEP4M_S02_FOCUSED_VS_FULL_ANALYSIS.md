# MGX Pro Step4-M S02 Focused vs Full Analysis

Comparison basis:
- Focused: `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4l.json`, `...07...`, `...08...`
- Full-suite trace audit: `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4m-detailed.json`, `...07...`, `...08...`
- Focused trace audit: `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4m-detailed.json`, `...07...`, `...08...`

Step4-L summary:
- Focused `300`-hand avg: Pro `-4.6`, Standard `34.6`, gap `-39.2`
- Required full-suite `100`-hand avg: Pro `-6.3`, Standard `36.3`, gap `-42.7`

## Focused vs Full

| Dimension | Focused Result | Full-suite Result | Difference | Suspected Cause |
| --- | ---: | ---: | --- | --- |
| Hands per seed | `300` | `100` | Focused samples `3x` more spots | Opportunity mix dominates the delta more than any single heuristic branch. |
| Runner structure | Same seat rotation / mirrored schedule | Same seat rotation / mirrored schedule | No structural routing difference | The mismatch is not coming from routing or evaluation mode. |
| Opponent mix | Standard vs Pro only | Standard vs Pro only | No variant mix difference | The regression is internal to S02 decision quality. |
| Safety | `illegal/freeze/EV fail = 0` | `illegal/freeze/EV fail = 0` | None | The issue is EV quality, not safety. |
| Fallback | ~`0.2549` | ~`0.2583` | Nearly identical | Full-suite regression is not explained by a fallback spike. |
| `premiumSDA5` first-in `BET` | `18` events, `+4300` total EV | `6` events, `+1620` total EV | Still positive in full-suite | Premium value betting is working, not leaking. |
| `premiumSDA5` facing-raise `CALL` | `14` events, `+3500` total EV | `5` events, `+1040` total EV | Still positive in full-suite | Premium defend/call line is not over-aggressive. |
| `strongSDA5` first-in `BET` | `40` events, `+8390` total EV | `9` events, `+2220` total EV | Fewer profitable spots in full-suite | Full-suite sees less volume of winning strong thin-value spots. |
| `upperMediumSDA5` value spots | Positive buckets in focused and full | Positive buckets in full (`first-in BET`: `+930`) | No evidence of systematic leak | The Step4-L upper-medium open/value line is not the primary regression source. |
| `trashSDA5` facing-bet `CALL` in `4way+` | `2014` events, `-19180` total EV | `682` events, `-4520` total EV | Dominant negative bucket in both | Early standard-rule continue decisions on trash hands remain the largest unresolved loss source. |
| `trashSDA5` facing-raise `FOLD` in `4way+` | `1296` events, `-21340` total EV | `448` events, `-7380` total EV | Dominant negative bucket in both | These folds mostly realize already-bad entry spots; the problem starts earlier. |

## Step4-M Interpretation

- Focused and full-suite use the same evaluation structure. The gap is not a seat-assignment or mirrored-run bug.
- The Step4-L `premiumSDA5` / `strongSDA5` / `upperMediumSDA5` value additions are positive in both focused and full-suite samples.
- The full-suite regression is better explained by sample-size sensitivity plus persistent `standard-rule` trash-hand continues in multiway spots.
- This means Step4-L likely improved the right part of S02, but that part is not large enough to offset the old early-street trash-call bucket in the `100`-hand suite.
- Step4-M therefore should not continue by reducing premium/strong value aggression further.

## Step4-M Decision

| Decision | Result |
| --- | --- |
| Suspect Step4-L premium/strong thin value as main regression source | Rejected |
| Suspect upper-medium open thin bet as main regression source | Rejected |
| Suspect multiway `standard-rule` trash continues before final value spots | Accepted |

Recommended next fix:
- Expand S02 pre-final and pre-draw betting coverage so `trashSDA5` and weak `9/T-low` hands stop inheriting `standard-rule` `CALL` decisions in `4way+` pots.
