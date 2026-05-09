# MGX Pro Step4-Z Report

Step4-Z note:
- D02 final bucket patch was restricted to `strongA5 second-pressure`
- S01 / S02 received no new heuristic
- targeted/full-suite runs below use fresh seeds `20260509/20260510/20260511`
- Step4-Y reference gaps were measured on earlier seeds, so direct comparison is directional rather than paired

| Variant | Step4Y Gap | Step4Z Gap | Result |
| ------- | ---------: | ---------: | ------ |
| D03 | `0.0` | `0.0` | unchanged |
| D01 | `-2.1` | `+4.6` | no regression |
| D02 | `-11.5` | `-26.93` | regressed on fresh full-suite seeds |
| S01 | `-14.0` | `-12.47` | slight improvement on fresh full-suite seeds |
| S02 | `-20.3` | `-20.47` | unchanged / noise-level regression |

## D02 Targeted

`500 hand x 3 seed` (`20260509/10/11`)

| Seed | Pro EV | Standard EV | Gap | Fallback |
| ---- | -----: | ----------: | --: | -------: |
| `20260509` | `11.50` | `18.50` | `-7.00` | `0.0000` |
| `20260510` | `5.76` | `24.24` | `-18.48` | `0.0000` |
| `20260511` | `6.28` | `23.72` | `-17.44` | `0.0000` |
| Avg | `7.85` | `22.15` | `-14.31` | `0.0000` |

## Full-suite

`100 hand x 3 seed` (`20260509/10/11`)

| Variant | Avg Pro EV | Avg Standard EV | Gap | Fallback | Safety |
| ------- | ---------: | --------------: | --: | -------: | ------ |
| D03 | `7.50` | `7.50` | `0.00` | `0.0000` | PASS |
| D01 | `17.30` | `12.70` | `4.60` | `0.0000` | PASS |
| D02 | `1.53` | `28.47` | `-26.93` | `0.0000` | PASS |
| S01 | `8.77` | `21.23` | `-12.47` | `0.0000` | PASS |
| S02 | `4.77` | `25.23` | `-20.47` | `0.0000` | PASS |

## Verdict

The final stable-bucket heuristic was safe, but it did not produce a robust D02 improvement. Step4-Z therefore marks the practical end of manual Pro heuristic tuning and recommends moving to Iron bootstrap with the Step4-Y action-value dataset.
