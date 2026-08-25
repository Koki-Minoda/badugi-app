# MGX Pro Step4-R Report

Step4-R は `S02` の sparse good-hand value spot を tiny diff で広げたが、required sample では Step4-Q から measurable improvement は出なかった。安全性と `fallback=0` は維持している。

| Variant | Step4Q Pro EV | Step4R Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | NEUTRAL |
| D01 | 13.9 | 13.9 | 16.1 | -2.1 | 0.0000 | PASS | NEUTRAL |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | NEUTRAL |
| S01 | 8.0 | 8.0 | 22.0 | -14.0 | 0.0000 | PASS | NEUTRAL |
| S02 | 4.9 | 4.9 | 25.1 | -20.3 | 0.0000 | PASS | NEUTRAL |

## S02 Focused

| Metric | Step4Q | Step4R |
| ------ | ------: | ------: |
| Pro EV/Hand | 8.96 | 8.96 |
| Standard EV/Hand | 21.04 | 21.04 |
| Gap | -12.09 | -12.09 |
| Fallback | 0.0000 | 0.0000 |

## S02 Full-Suite

| Metric | Step4Q | Step4R |
| ------ | ------: | ------: |
| Pro EV/Hand | 4.87 | 4.87 |
| Standard EV/Hand | 25.13 | 25.13 |
| Gap | -20.27 | -20.27 |
| Fallback | 0.0000 | 0.0000 |

## Notes

- `premiumSDA5 / strongSDA5` の value line は引き続き positive bucket。
- Step4-R の `upperMediumSDA5 3way` / `upperStrong medium-pressure` 拡張は安全だが、required sample では出現頻度が低く aggregate を動かせなかった。
- 次に詰めるなら、single-draw family ではなく `D02` か、より長い sample での variance 確認に移る方が効率がよい。
