# MGX Pro Step4-D Report

Seeds: `20260506`, `20260507`, `20260508`  
Hands per variant per seed: `100`

| Variant | Step4C Pro EV | Step4D Pro EV | Standard EV | EV Gap Change | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | ------------: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -19.4 | -19.4 | 49.4 | 0.0 | 0.2481 | PASS | IMPROVED_NOT_READY |
| D02 | -71.3 | -22.9 | 52.9 | +96.7 | 0.2272 | PASS | IMPROVED_NOT_READY |
| S01 | -9.7 | -9.6 | 39.6 | +0.1 | 0.2653 | PASS | IMPROVED_NOT_READY |
| S02 | -5.8 | -2.9 | 32.9 | +5.9 | 0.2584 | PASS | IMPROVED_NOT_READY |

## Notes

- `D02` is the main Step4-D win. The 3-seed EV gap shrank from `-172.5` to `-75.8`.
- `D01` held its Step4-C gains but did not improve further on the 3-seed average.
- `S01` stayed effectively flat, while `S02` improved modestly through stronger single-draw value realization.
- `D03` did not regress, but it also did not move above Standard.

## D02 300-Hand Supplemental Check

| Seed | Pro EV | Standard EV | EV Gap | Fallback | Safety | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `20260506` | -8.2 | 38.2 | -46.4 | 0.2254 | PASS | IMPROVED_NOT_READY |
| `20260507` | -13.4 | 43.4 | -56.8 | 0.2250 | PASS | IMPROVED_NOT_READY |
