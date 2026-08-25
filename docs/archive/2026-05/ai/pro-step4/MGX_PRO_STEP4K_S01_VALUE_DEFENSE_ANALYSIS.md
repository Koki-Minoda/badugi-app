# MGX Pro Step4-K S01 Value/Defense Analysis

Focused source runs:
- `reports/ai-eval/pro-vs-standard-20260506-s01-300-step4k.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-300-step4k.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-300-step4k.json`

Step4-K narrows the S01 work to two changes only:
- add one more thin-value layer on the top of `strongSD27`
- split rough `9-low` into upper/lower branches and cut the lower branch out of defense

| Hand Class | Subclass | Facing Action | Current Action | EV Impact | Suggested Rule |
| --- | --- | --- | --- | ---: | --- |
| `strongSD27` | rough `8-low` upper | first in | `BET` | high positive | Keep the new open value line and allow thin value raises only versus small pressure. |
| `strongSD27` | non-rough `9-low` good shape | small bet | `CALL` | medium positive | Keep small-bet defense and avoid re-opening large-pressure calls. |
| `strongSD27` | non-rough `9-low` good shape | medium bet | selected `CALL` | medium positive | Preserve the selected medium continue rule only for the strongest `9-low` shapes. |
| `mediumSD27` | upper rough `9-low` | small bet | `CALL` | low positive | Keep as the last defendable rough `9-low` branch. |
| `mediumSD27` | upper rough `9-low` | medium / large bet | `FOLD` | medium positive | Do not let upper rough `9-low` drift back into medium-pressure defense. |
| `mediumSD27` | lower rough `9-low` | any bet | `FOLD` | high positive | Keep the lower branch out of the line entirely. |
| `mediumSD27` | `T-low` | any bet | `FOLD` | medium positive | Preserve the `CHECK/FOLD` floor. |

## Focused Metrics

| Seed | Pro EV | Standard EV | Gap | Fallback | Value Bet Freq | Call Facing Bet Freq | Fold Facing Bet Freq | Raise Freq |
| ---- | -----: | ----------: | --: | -------: | -------------: | -------------------: | -------------------: | ---------: |
| `20260506` | `-1.0` | `31.0` | `-32.0` | `0.2635` | `0.0076` | `0.2666` | `0.1248` | `0.0003` |
| `20260507` | `3.1` | `26.9` | `-23.7` | `0.2535` | `0.0127` | `0.2614` | `0.1424` | `0.0007` |
| `20260508` | `-5.3` | `35.3` | `-40.7` | `0.2613` | `0.0082` | `0.2641` | `0.1298` | `0.0014` |

## Verdict

Step4-K improves `S01` again. The next S01 pass, if needed, should be much smaller than this one: only the very best `strongSD27` thin-value spots remain under-realized.
