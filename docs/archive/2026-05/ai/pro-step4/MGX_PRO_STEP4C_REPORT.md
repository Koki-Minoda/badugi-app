# MGX Pro Step4-C Report

Seeds: `20260506`, `20260507`, `20260508`  
Hands per variant per seed: `100`

| Variant | Step4B EV | Step4C Avg EV | Standard Avg EV | EV Gap | Fallback Avg | Verdict | Next Action |
| ------- | --------: | ------------: | --------------: | -----: | -----------: | ------- | ----------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | IMPROVED_NOT_READY | Improve medium-strength Badugi value realization to move above Standard. |
| D01 | -72.4 | -19.4 | 49.4 | -68.8 | 0.2481 | IMPROVED_NOT_READY | Focus on rough 8/9-low facing-bet folds and smoother 8-low value extraction. |
| D02 | -93.4 | -71.3 | 101.3 | -172.5 | 0.2668 | REGRESSED | Rework A-5 post-draw calling thresholds; current rough-low defense still leaks too much EV. |
| S01 | -8.2 | -9.7 | 39.7 | -49.5 | 0.2656 | IMPROVED_NOT_READY | Add more value betting on strong completed one-draw lows while keeping bluff frequency near zero. |
| S02 | -7.8 | -5.8 | 35.8 | -41.6 | 0.2610 | IMPROVED_NOT_READY | Increase wheel/clean 6/7-low value bets and keep rough 8-low on call/check rails. |

## Key Outcomes

- `D01` improved materially from Step4-B and produced one positive Pro EV seed (`20260508`), but it is still below Standard on average.
- `D02` improved relative to Step4-B's worst seed but remains the largest EV gap and the top blocker.
- `S01` and `S02` stayed within the fallback/safety gates, yet still leave too much value unrealized after the single draw.
- `D03` kept `fallback = 0.0000` and safety clean, but EV stayed neutral instead of improving.

## Safety

| Variant | Illegal | Freeze | EV Fail | Status |
| ------- | ------: | -----: | ------: | ------ |
| D03 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D02 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S02 | 0.0000 | 0.0000 | 0.0000 | PASS |
