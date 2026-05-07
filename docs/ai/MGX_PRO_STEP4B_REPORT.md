# MGX Pro Step4-B Report

Seeds: `20260506`, `20260507`  
Hands per variant: `100`

## Step4-B Summary

| Variant | Before Pro EV | After Pro EV | Standard EV | Fallback | Verdict | Next Action |
| ------- | ------------: | -----------: | ----------: | -------: | ------- | ----------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0000 | IMPROVED_BUT_NOT_READY | Keep new Badugi betting coverage and tune medium-strength value/call thresholds to move above Standard. |
| D01 | -112.8 | -72.4 | 102.4 | 0.2510 | IMPROVED_BUT_NOT_READY | Tighten rough 8/9-low defense and keep premium 7-low value betting aggressive. |
| D02 | -87.0 | -93.4 | 123.4 | 0.2671 | REGRESSED | Rework A-5 final-round bluff-catch logic and separate premium lows from paired or rough lows. |
| S01 | -29.0 | -8.2 | 38.2 | 0.2684 | IMPROVED_BUT_NOT_READY | Keep single-draw split and add selective value bets after the only draw completes. |
| S02 | -28.6 | -7.8 | 37.8 | 0.2603 | IMPROVED_BUT_NOT_READY | Increase value realization for wheel and clean 6/7-low made hands. |

## Seed Cross-Check

| Variant | Pro EV 20260506 | Pro EV 20260507 | Standard EV 20260506 | Standard EV 20260507 | Fallback 20260506 | Fallback 20260507 |
| ------- | --------------: | --------------: | -------------------: | -------------------: | ----------------: | ----------------: |
| D03 | 7.5 | 7.5 | 7.5 | 7.5 | 0.0000 | 0.0000 |
| D01 | -72.4 | -20.6 | 102.4 | 50.6 | 0.2510 | 0.2476 |
| D02 | -93.4 | -96.8 | 123.4 | 126.8 | 0.2671 | 0.2601 |
| S01 | -8.2 | 4.2 | 38.2 | 25.8 | 0.2684 | 0.2606 |
| S02 | -7.8 | -7.2 | 37.8 | 37.2 | 0.2603 | 0.2497 |

## Safety

| Variant | Illegal | Freeze | EV Fail | Status |
| ------- | ------: | -----: | ------: | ------ |
| D03 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D02 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S02 | 0.0000 | 0.0000 | 0.0000 | PASS |

## Notes

- Step4-B achieved the fallback target for every required variant.
- Step4-B did not achieve `Pro EV >= Standard EV` on any variant except the neutral `D03` tie.
- The remaining blocker is decision quality, not routing or safety.
