# MGX Pro Step4-O D01 Leak Deep Dive

Baseline source:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4n.json`

Validation source:
- `reports/ai-eval/pro-vs-standard-20260506-d01-100-step4o-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-d01-100-step4o-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-d01-100-step4o-detailed.json`

## Leak Summary

| Leak Type | Count | EV Impact | Draw Round | Hand Class | Facing Action | Pro Action | Suggested Fix |
|---|---:|---:|---|---|---|---|---|
| `CALL losing call` | 144 baseline fallback samples | High | Mostly `0`, some `1-2` | paired/penalty trash and rough `8/9/T-low` | `4way+` or pressure pots, usually `CALL` legal | Pre-Step4-O inherited `standard-fallback CALL` | Intercept D01 before generic call rails so trash/weak hands fold early and late. |
| `late street facing bet leak` | 24 small-call fallback samples after round `0` in Step4-N baseline | Medium | `1-2` | rough `8-low`, rough `9-low`, `T-low` | small and medium pressure | weak `CALL` / fallback continue | Keep `rough 8-low` on small-call only, and cut `rough 9-low` / `T-low` to fold-heavy rails. |
| `rough 8-low over-defense` | seen in loss samples and prior fallback rails | Medium | final | `strong27TD` lower end | medium/large pressure | `CALL` too often | Allow small-call defense only, selected medium defense only for the best rough `8-low`, fold large pressure. |
| `rough 9-low over-defense` | recurring in baseline medium buckets | Medium | final | `medium27TD` | any real pressure | `CALL` too often | Split upper/lower rough `9-low`; upper may tiny-call once, lower folds. |
| `straight/flush penalty hand defense` | 144 baseline fallback samples include paired/penalty hands; 58 pat-mistake samples include penalty redraws | High | all | `trash27TD` | facing bet | inherited `CALL` or weak continue | Treat straight/flush/pair hands as trash on D01 betting streets; fold instead of bluff-catching. |
| `weak pat hand overvalue` | 58 baseline pat-mistake samples | Medium | mostly `1-3` | paired/penalty holdings that were still being improved | draw / late bet | weak pat and fallback continue mix | Keep drawing through pair/penalty holdings and do not defend them on final betting. |
| `strong 7-low missed value` | low frequency in baseline; preserved in Step4-O validation | Low | final | `premium27TD` | first-in / facing small bet | too passive in older rails | Preserve value bet / selected raise rails while cutting weak defense elsewhere. |
| `smooth 8-low missed value` | low frequency in baseline; preserved in Step4-O validation | Low | final | `premium27TD` upper | first-in | too passive in older rails | Keep smooth `8-low` on value-bet rails. |
| `bad draw / bad pat` | 58 baseline pat-mistake samples | Medium | `1-3` | pair / two-pair / straight penalty hands | draw decision | `lowball-improve-draw` still cleaning up weak made structures | Do not alter existing pair/high-card discard logic; validate that Step4-O betting changes do not break draw rails. |

## Baseline Evidence

- Step4-N D01 full-suite average: `Pro -3.0 / Standard 33.0 / Gap -36.0 / Fallback 0.1311`
- Baseline fallback samples: `144`
  - `120` were `drawRound 0` `CALL | standard-fallback | large`
  - `19` were `drawRound 1` `CALL | standard-fallback | small`
  - `4` were `drawRound 2` `CALL | standard-fallback | small`
- Baseline loss samples were dominated by rough high-card lows:
  - `highCard|14 = 38`
  - `highCard|13 = 31`
  - `highCard|12 = 17`
  - `highCard|11 = 13`
  - `highCard|10 = 10`
- Baseline pat/draw mistake samples: `58`
  - mostly `lowball-improve-draw` on `onePair` / `twoPair` / `straight` holdings, which indicates draw cleanup rather than premium made-low errors.

## Step4-O Validation

- Step4-O removes D01 fallback on the evaluated suite: `0.1311 -> 0.0000`
- Step4-O focused `300-hand x 3 seed`: `Pro 17.8 / Standard 12.2 / Gap +5.7`
- Step4-O full `100-hand x 3 seed`: `Pro 13.9 / Standard 16.1 / Gap -2.1`

The result matches the intended fix:
- weak `CALL` inheritance is gone
- rough `8/9-low` defense is narrower
- premium / strong value rails remain intact
