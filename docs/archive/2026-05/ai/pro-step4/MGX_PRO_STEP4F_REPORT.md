# MGX Pro Step4-F Report

Seeds: `20260506`, `20260507`, `20260508`  
Full-suite hands per variant per seed: `100`  
Supplemental D02 run: `300` hands per seed

| Variant | Step4E Pro EV | Step4F Pro EV | Standard EV | EV Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | -----: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -19.4 | -3.0 | 33.0 | -36.0 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.9 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -9.6 | -9.6 | 39.6 | -49.2 | 0.2653 | PASS | IMPROVED_NOT_READY |
| S02 | -2.9 | -9.8 | 39.8 | -49.6 | 0.2584 | PASS | REGRESSED |

## Notes

- `D01` is the main Step4-F win. The 3-seed gap moved from `-68.8` to `-36.0`.
- `D02` held its safety and zero-fallback profile, and the targeted `300`-hand runs improved slightly to an average gap of `-6.6`, but the full-suite `100`-hand average slipped from `-10.2` to `-11.5`.
- `S01` stayed flat.
- `S02` regressed under the more selective single-draw betting rules and needs another pass before Iron readiness is reconsidered.

## D02 300-Hand Supplemental Check

| Seed | Pro EV | Standard EV | EV Gap | Fallback | Call Rate | Losing Call Rate | Safety |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `20260506` | 12.9 | 17.1 | -4.2 | 0.0000 | 0.0068 | 0.0000 | PASS |
| `20260507` | 9.7 | 20.3 | -10.5 | 0.0000 | 0.0087 | 0.4615 | PASS |
| `20260508` | 12.5 | 17.5 | -4.9 | 0.0000 | 0.0061 | 0.1111 | PASS |

Average:
- Pro EV: `11.7`
- Standard EV: `18.3`
- EV gap: `-6.6`
- Fallback: `0.0000`
- Call rate: `0.0072`
- Losing call rate: `0.1909`

## Verdict

`IMPROVED_NOT_READY`

Step4-F improves the broader draw-lowball picture through `D01`, keeps `D03` stable, and leaves D02 near Step4-E while preserving perfect safety. It does not meet Iron readiness because `D01/D02/S01/S02` remain below Standard and `S02` regressed.
