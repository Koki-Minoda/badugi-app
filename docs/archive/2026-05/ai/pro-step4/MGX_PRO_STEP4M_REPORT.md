# MGX Pro Step4-M Report

Required runs executed:
- `npm run test:ai:pro`
- `npm run test:game:one-hand`
- `npm run test:game:ev`
- `npm run test:rl:safety`
- `npm run eval:ai:pro -- --hands=300 --seed=20260506 --variants=S02`
- `npm run eval:ai:pro -- --hands=300 --seed=20260507 --variants=S02`
- `npm run eval:ai:pro -- --hands=300 --seed=20260508 --variants=S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260506 --variants=S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260507 --variants=S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260508 --variants=S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260506 --variants=D03,D01,D02,S01,S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260507 --variants=D03,D01,D02,S01,S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260508 --variants=D03,D01,D02,S01,S02`

## Evaluation Summary

| Variant | Step4K EV | Step4L EV | Step4M EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | --------: | --------: | --------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | -3.0 | 33.0 | -36.0 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -0.3 | -0.3 | -0.3 | 30.3 | -30.5 | 0.2631 | PASS | IMPROVED_NOT_READY |
| S02 | -5.4 | -6.3 | -8.6 | 38.6 | -47.2 | 0.2585 | PASS | REGRESSED |

## S02 Focused vs Full

| Mode | Step4L Pro EV | Step4M Pro EV | Standard EV | Gap | Verdict |
| ---- | ------------: | ------------: | ----------: | --: | ------- |
| Focused `300` x `3` | -4.6 | -9.4 | 39.4 | -48.8 | REGRESSED |
| Standalone `100` x `3` | -6.3 baseline-equivalent | -8.6 | 38.6 | -47.2 | REGRESSED |
| Required full-suite `100` x `3` | -6.3 | -8.6 | 38.6 | -47.2 | REGRESSED |

## S02 Spot Decisions

| S02 Spot | Step4L Behavior | Step4M Behavior | EV Impact | Decision |
| -------- | --------------- | --------------- | --------: | -------- |
| `premiumSDA5` first-in final value | `BET` | `BET` kept | Positive in focused and full | Keep |
| `premiumSDA5` facing safe pressure | Allowed value raise | Restricted to heads-up small spots | Removing aggression hurt results | Reject Step4-M trim |
| `strongSDA5` first-in final value | `BET` | `BET` kept | Positive in focused and full | Keep |
| `strongSDA5` facing medium pressure | `CALL` available | Reduced in multiway | Reduction did not improve EV | Reject Step4-M trim |
| `upperMediumSDA5` open thin value | Allowed where legal | Suppressed in large multiway | No evidence this was the leak | Reject Step4-M trim |
| `trashSDA5` `4way+` facing-bet `CALL` | Mostly inherited from `standard-rule` | Unchanged | Dominant negative bucket | Next fix target |

## Step4-M Verdict

- The audit succeeded: the focused/full-suite mismatch is now explained.
- The attempted safety-side trim failed: both focused and full-suite S02 EV got worse.
- The remaining high-value next step is not more final-street suppression. It is earlier S02 overlay coverage that blocks `standard-rule` `CALL` inheritance on `trashSDA5` and weak `9/T-low` hands in `4way+` pots.
