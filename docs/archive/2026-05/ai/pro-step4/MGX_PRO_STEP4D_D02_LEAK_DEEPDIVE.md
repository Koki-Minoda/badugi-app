# MGX Pro Step4-D D02 Leak Deep Dive

Sources:
- `docs/ai/MGX_PRO_STEP4C_EV_ACTION_ATTRIBUTION.md`
- `reports/ai-eval/pro-vs-standard-20260506.json`
- `reports/ai-eval/pro-vs-standard-20260507.json`
- `reports/ai-eval/pro-vs-standard-20260508.json`
- `reports/ai-eval/pro-vs-standard-20260506-d02-300.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300.json`

| Leak | Count | EV Impact | Street | Hand Class | Facing Action | Current Pro Action | Suggested Fix |
|---|---:|---:|---|---|---|---|---|
| `PAT too weak` | 143 | 9460.0 | Draw to final betting | `weakA5`, `trashA5`, paired finals, rough `8/9-low` | none, then later bet faced | Pats too many weak made lows before the last betting round | Keep `premiumA5` and `strongA5` on pat rails; make `weakA5` and pair-heavy finals draw or check/fold more often. |
| `CALL losing call` | 144 | 864.0 | Final betting | `mediumA5` and `weakA5` | bet/call faced | Calls too many late bets with rough `8/9-low` and pair-heavy bluff-catch hands | Restrict final calls to `premiumA5`, `strongA5`, and only the cheapest `mediumA5` spots. |
| `facing bet leak` | 144 | 720.0 | Final betting | rough `7/8-low`, weak `9-low` | late bet or raise | Defends too wide instead of folding weak A-5 made lows | Separate `mediumA5` cheap-call spots from `weakA5` and `trashA5` fold spots. |
| `missed value bet` | 6 | 290.0 | Final betting | wheel, `6-low`, smooth `7-low` | unopened or single bet faced | Checks/calls with some hands that should bet or raise for value | Push `premiumA5` to `BET/RAISE`; let `strongA5` bet more often when unopened. |
| `wrong fold` | 6 | 290.0 | Final betting | premium low but paired texture samples | bet faced | Over-folds some premium-looking A-5 bluff-catch spots after seeing pair-heavy boards | Distinguish real trash from premium made lows with a pair-shaped category leak. |
| `weak final call` | 144 | 864.0 | Final betting | rough `8-low`, `9-low` | bet faced | Calls with weak made lows at non-trivial prices | Do not call `9-low` high-price spots; rough `8-low` should usually fold unless price is minimal. |
| `rough 8/9-low over-defense` | 144 | 720.0 | Final betting | `weakA5` | bet or raise faced | Over-defends with rough lows that should not continue | Force `weakA5` to `CHECK/FOLD` by default and ban raises entirely. |
| `paired final leak` | 143 | 9460.0 | Draw and final betting | paired or pair-heavy `trashA5` | any | Pair branch still leaks through pat/check/call paths too often | Treat pair-heavy A-5 hands as `trashA5`: discard first, then `CHECK/FOLD` later unless the price is trivial. |

## Supplemental 300-Hand Check

| Seed | Hands | Pro EV | Standard EV | EV Gap | Fallback | Safety |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `20260506` | 300 | -8.2 | 38.2 | -46.4 | 0.2254 | PASS |
| `20260507` | 300 | -13.4 | 43.4 | -56.8 | 0.2250 | PASS |

## Interpretation

- Step4-D materially reduced the D02 gap versus Step4-C, but `mediumA5` and `weakA5` still defend too often late.
- The biggest remaining issue is not fallback or safety. It is category precision: `premiumA5`/`strongA5` versus `weakA5`/`trashA5` is still not sharp enough when facing action.
