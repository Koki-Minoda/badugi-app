# MGX Step4 Readiness

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506.json`
- `reports/ai-eval/pro-vs-standard-20260507.json`
- `reports/ai-eval/pro-vs-standard-20260508.json`

## Average EV Summary

| Variant | Avg Pro EV | Avg Standard EV | EV Gap | Fallback Avg | Safety | Verdict |
| ------- | ---------: | --------------: | -----: | -----------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -19.4 | 49.4 | -68.8 | 0.2481 | PASS | IMPROVED_NOT_READY |
| D02 | -71.3 | 101.3 | -172.5 | 0.2668 | PASS | REGRESSED |
| S01 | -9.7 | 39.7 | -49.5 | 0.2656 | PASS | IMPROVED_NOT_READY |
| S02 | -5.8 | 35.8 | -41.6 | 0.2610 | PASS | IMPROVED_NOT_READY |

## Readiness Gates

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Avg Pro EV >= Avg Standard EV on D03/D01/D02/S01/S02 | FAIL | `D03` is neutral across all 3 seeds, and `D01/D02/S01/S02` remain below Standard on average. |
| Fallback < 30% on all target variants | PASS | `D03/D01/D02/S01/S02` are all below `0.30` across all 3 seeds. |
| Safety stable (`illegal`, `freeze`, `EV fail` all zero) | PASS | Every executed target variant stayed at `0` on all 3 seeds. |
| Pro overlay is actually deciding actions | PASS | `D03` is fully overlay-driven and the lowball variants remain mostly overlay-driven while fallback stays sub-`0.30`. |
| Leak cause is identifiable | PASS | [MGX_PRO_STEP4C_EV_ACTION_ATTRIBUTION.md](/home/mgx/badugi-app/docs/ai/MGX_PRO_STEP4C_EV_ACTION_ATTRIBUTION.md) isolates `PAT too weak`, `CALL losing call`, and facing-bet leaks. |

## Verdict

`NO`

Step4-C keeps safety and fallback within target, but Iron readiness is still blocked by EV quality. `D01` improved the most, `D02` stopped being the worst single-seed regression from Step4-B but still trails Standard badly, and `S01/S02` remain too passive in value realization.

## Required Next Work

| Priority | Variant | Required Fix |
| -------- | ------- | ------------ |
| P0 | D02 | Rebuild A-5 final-street thresholds around wheel/6-low/7-low value lines and much tighter rough 8/9-low defense. |
| P0 | D01 | Keep the current gains, then trim `PAT too weak` and late `CALL losing call` volume on rough 8/9-low holdings. |
| P0 | S01/S02 | Add selective single-draw value betting for improved finals so strong made lows stop under-realizing EV. |
| P1 | D03 | Move from neutral to positive EV by tuning medium made Badugi bets and cheap-call defense. |
