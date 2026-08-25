# MGX Pro Step4-S D02 Residual Defense Analysis

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260508-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-100-step4s-baseline-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-100-step4s-current-detailed.json`

## Summary

Step4-S tightens `strongA5` repeated-pressure defense and narrows `mediumA5` small-call eligibility, but the required `100-hand x 3 seed` full-suite aggregate does not move. The residual D02 leak appears too sparse in the sampled suite to materially change EV without a broader trace or a different bucket.

- Full-suite average stays at `Pro 9.23 / Standard 20.77 / Gap -11.53`
- Focused `300-hand x 3 seed` shifts slightly from Step4-O `Gap -6.56` to Step4-S `Gap -6.80`
- All executed D02 suites remain `fallback=0.0000`, `illegal=0`, `freeze=0`, `EV fail=0`

## Residual Buckets

| Hand Class | Spot | Count | EV Impact | Pro Action | Standard Action | Suggested Fix |
| --- | --- | ---: | ---: | --- | --- | --- |
| `strongA5` | first small pressure | sparse | mildly positive | `CALL` retained | similar continue | keep; this is not the leak |
| `strongA5` | repeated medium pressure / second barrel | sparse | mildly negative in focused samples only | Step4-S folds earlier | Standard still continues more often | only revisit with longer-sample targeted tracing |
| `strongA5` | large pressure | very sparse | negative when it appears | Step4-S folds | Standard may still call | keep tighter fold rule |
| `mediumA5` upper | small pressure | sparse | near-neutral | Step4-S still allows tiny `CALL` | Standard calls more often | acceptable; not worth reopening yet |
| `mediumA5` lower / rough `8-low` | medium pressure | sparse | negative | Step4-S folds | Standard may still continue | keep folded |
| `weak 8/9-low` / paired final | facing bet | sparse | negative | Step4-S folds | Standard may still continue | keep folded |
| `premiumA5` | first-in / value line | visible and positive | positive | unchanged `BET/RAISE` line | positive for both tiers | do not trim premium value |

## Focused Seed Comparison

| Seed | Step4-O Pro EV | Step4-S Pro EV | Step4-O Gap | Step4-S Gap | Call Rate Before | Call Rate After | Losing Call Rate Before | Losing Call Rate After |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `20260506` | `12.90` | `12.90` | `-4.20` | `-4.20` | `0.0068` | `0.0068` | `0.0000` | `0.0000` |
| `20260507` | `9.73` | `9.93` | `-10.53` | `-10.13` | `0.0087` | `0.0068` | `0.4615` | `0.3000` |
| `20260508` | `12.53` | `11.97` | `-4.93` | `-6.07` | `0.0061` | `0.0048` | `0.1111` | `0.0000` |

## Detailed Trace Check

The matched detailed `100-hand` seed `20260507` baseline/current traces are unchanged at aggregate level:

| Trace | Pro EV | Standard EV | Gap | Fallback Samples | Loss Samples | Pat Mistake Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | `3.2` | `26.8` | `-23.6` | `0` | `0` | `1` |
| current | `3.2` | `26.8` | `-23.6` | `0` | `0` | `1` |

Interpretation:
- the Step4-S guard hits are real in some `300-hand` focused samples
- the required `100-hand` suite simply does not surface enough of those exact `strongA5` / `upper-mediumA5` pressure spots to move average EV
- D02 is now in the same state as late Step4-R S02: safe, deterministic, but resistant to tiny heuristic trimming

## Decision

- Keep the Step4-S tighter `strongA5` repeated-pressure fold rules
- Keep the narrower `mediumA5` small-call gate
- Do not touch `premiumA5` value lines
- Do not expect another similarly small D02 defense tweak to move the required aggregate without longer-sample evidence
