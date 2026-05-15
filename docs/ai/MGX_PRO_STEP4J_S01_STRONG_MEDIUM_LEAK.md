# MGX Pro Step4-J S01 Strong/Medium Leak

Focused source runs:
- `reports/ai-eval/pro-vs-standard-20260506-s01-300-step4j.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-300-step4j.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-300-step4j.json`

The Step4-J change set improves `S01` by narrowing the bottom of `mediumSD27` defense while keeping `strongSD27` in the value line. The remaining gap is still dominated by under-realized made lows rather than safety or fallback failures.

| Hand Class | Leak Type | Count | EV Impact | Facing Action | Pro Action | Suggested Fix |
| --- | --- | ---: | ---: | --- | --- | --- |
| `strongSD27` | missed value / under-bet | medium | high | unopened final street | `BET` is still too rare relative to Standard | Increase thin value on the top of `strongSD27`, especially the clean `8/9-low` subset. |
| `strongSD27` | facing raise leak | low | medium | medium / large pressure | `CALL` on some medium pressure remains acceptable, but large pressure folds are now correct | Keep current fold line; do not re-open large-pressure defense. |
| `mediumSD27` | losing call | low | medium | small bet | bottom-edge `mediumSD27` still calls some thin spots | Trim the weakest rough `9-low` continues before touching stronger holdings. |
| `mediumSD27` | lower-bound defense leak | low | medium | small / medium pressure | `T-low` now folds, but rough `9-low` still consumes some thin defense | Split top/bottom `mediumSD27` if another S01 pass is needed. |
| penalty hands | leakage | low | low | final facing bet | `pair/straight/flush` are mostly out of line already | Preserve the current penalty gating. |
| made low value | strong made low under-realization | medium | high | unopened final street | value-bet frequency remains far below Standard | Improve only the strongest non-premium `2-7` single-draw finals before touching bluffing. |

## Focused Metrics

| Seed | Pro EV | Standard EV | Gap | Fallback | Value Bet Freq | Call Facing Bet Freq | Fold Facing Bet Freq |
| ---- | -----: | ----------: | --: | -------: | -------------: | -------------------: | -------------------: |
| `20260506` | `-3.0` | `33.0` | `-36.0` | `0.2642` | `0.0059` | `0.2673` | `0.1217` |
| `20260507` | `-0.9` | `30.9` | `-31.7` | `0.2540` | `0.0096` | `0.2619` | `0.1375` |
| `20260508` | `-8.0` | `38.0` | `-46.0` | `0.2617` | `0.0062` | `0.2644` | `0.1276` |

## Verdict

Step4-J improves `S01` versus Step4-I, but the remaining leak is still a value-realization problem. The next S01 pass should add thin value only to the top edge of `strongSD27` and keep the new `mediumSD27` folds intact.
