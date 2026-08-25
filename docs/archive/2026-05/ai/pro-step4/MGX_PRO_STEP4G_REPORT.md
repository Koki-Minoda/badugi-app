# MGX Pro Step4-G Report

Seeds: `20260506`, `20260507`, `20260508`  
Focused S01/S02 run: `300` hands per seed  
Full-suite run: `100` hands per variant per seed

| Variant | Step4F Pro EV | Step4G Pro EV | Standard EV | Gap | Frequency Rate | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------------: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | 33.0 | -36.0 | 0.0000 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -10.4 | -10.4 | 40.4 | -50.8 | 0.0017 | 0.2654 | PASS | IMPROVED_NOT_READY |
| S02 | -15.0 | -15.0 | 45.0 | -60.0 | 0.0056 | 0.2585 | PASS | REGRESSED |

## Frequency Summary

| Variant | Frequency Rate | Value Bet Frequency | Check Back Frequency | Fold Facing Bet Frequency | Call Facing Bet Frequency | Raise Frequency |
| ------- | -------------: | ------------------: | -------------------: | ------------------------: | ------------------------: | --------------: |
| S01 | 0.0017 | 0.0014 | 0.3019 | 0.1149 | 0.2689 | 0.0007 |
| S02 | 0.0056 | 0.0010 | 0.2454 | 0.1845 | 0.2692 | 0.0000 |

## Notes

- Frequency control is live and deterministic for single-draw decisions.
- `S02` did not recover. The deterministic mix still leans too passive and leaves value unrealized.
- `S01` did not regress, but the new mechanism is only barely active there and does not improve EV yet.
- `D01`, `D02`, and `D03` were not materially affected by the single-draw-only frequency change.

## Verdict

`BLOCKED`

Step4-G satisfies the implementation and safety requirements for deterministic frequency control, but it fails the user-facing goal because `S02` does not improve and remains the main blocker to Iron readiness.
