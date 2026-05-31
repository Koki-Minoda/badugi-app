# MGX Pro Step4-E Report

Target: `D02 A-5 Triple Draw`  
Objective: reduce `CALL losing call` and `facing bet leak` by cutting weak-hand defense.

## D02 Comparison

| Metric | Step4-D | Step4-E |
| --- | --- | --- |
| Pro EV | `-22.9` (3-seed avg, 100 hands) | `9.9` (3-seed avg, 100 hands) |
| Standard EV | `52.9` (3-seed avg, 100 hands) | `20.1` (3-seed avg, 100 hands) |
| Gap | `-75.8` | `-10.2` |
| Fallback Rate | `0.2272` | `0.0000` |
| Call Rate | `N/A` | `0.0056` |
| Losing Call Rate | `N/A` | `0.0000` |
| Safety | PASS | PASS |

## D02 300-Hand Supplemental Check

| Metric | Step4-D | Step4-E |
| --- | --- | --- |
| Pro EV | `-10.8` avg (`-8.2`, `-13.4`) | `11.5` avg (`14.0`, `9.1`) |
| Standard EV | `40.8` avg (`38.2`, `43.4`) | `18.5` avg (`16.0`, `20.9`) |
| Gap | `-51.6` avg | `-7.0` avg |
| Fallback Rate | `0.2252` avg | `0.0000` avg |
| Call Rate | `N/A` | `0.0094` avg |
| Losing Call Rate | `N/A` | `0.2813` avg |
| Safety | PASS | PASS |

## Notes

- Step4-E is the strongest D02 EV improvement so far. The 3-seed 100-hand gap shrank from `-75.8` to `-10.2`.
- The defensive fold policy worked as intended: observed `weakA5` and `trashA5` calls dropped to zero in the Step4-E sample.
- Remaining D02 leakage is now concentrated in `strongA5` bluff-catch calls, especially when the same hand keeps defending through multiple betting rounds.
- `D03`, `D01`, `S01`, and `S02` did not change on the refreshed 3-seed suite because Step4-E only touched D02 betting thresholds.

## Verdict

`IMPROVED_NOT_READY`

Step4-E gets D02 much closer to Standard without introducing safety regressions. It is still below Standard on the 3-seed average, so Iron remains blocked, but D02 is no longer the dominant outlier.
