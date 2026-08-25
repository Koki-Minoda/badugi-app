# MGX 10-Game RL Readiness Report

Date: 2026-05-06

This report validates the Beginner/Standard RL rollout surface for the fixed 10-Game rotation. It does not claim Pro/Iron strength; long runs must still pass progression, EV, RL-safety, and human/practice gates before model promotion.

## Summary

| Item | Value |
|---|---:|
| Target variants | 10 |
| Tier routes | 20 |
| Route OK | 20 |
| Blocking issues | 0 |
| Long RL ready | YES |

## Variant Dataset / Reward / Action Mask Plan

| Variant | Family | Feature | Reward Source | Action Mask | Dataset | Short Gate | Notes |
|---|---|---|---|---|---|---|---|
| `B01` NL Hold'em | board:nlh | board-betting-observation-v1 `16->6` | BoardBettingEnv / BoardLongHorizonEnv EV-shaped reward | BoardBettingEnv.legal_action_mask() | synthetic board fixtures + future hand-history EV gate | evaluate_board_onnx.py --advanced-gate | NLH needs real-log position/showdown EV before Pro promotion. |
| `B02` FL Hold'em | board:flh | board-betting-observation-v1 `16->6` | BoardBettingEnv fixed-limit reward | BoardBettingEnv.legal_action_mask() with cap pressure | synthetic board fixtures + fixed-limit cap history gate | evaluate_board_onnx.py --advanced-gate | FLH must retain cap/crying-call fixtures. |
| `B06` PLO8 | board:plo8 | board-betting-observation-v1 `16->6` | BoardBettingEnv PLO8 scoop/no-low reward | BoardBettingEnv.legal_action_mask() | synthetic PLO8 fixtures + split/quartering real-log gate | evaluate_board_onnx.py --advanced-gate | PLO8 must preserve scoop/no-low and quartering reward gates. |
| `ST3` Razz | stud:razz | stud-betting-observation-v1 `16->6` | StudBettingEnv Razz low reward | StudBettingEnv.legal_action_mask() | synthetic Razz fixture dataset + future low-board real logs | evaluate_stud_onnx.py fixture gate for ST3 | Razz needs complete/low-board pressure hand-history gates before stronger tiers. |
| `ST1` Stud | stud:stud | stud-betting-observation-v1 `16->6` | StudBettingEnv high-hand reward | StudBettingEnv.legal_action_mask() | synthetic Stud fixture dataset + future bring-in/complete real logs | evaluate_stud_onnx.py fixture gate for ST1 | Stud long RL is blocked from higher tiers until UI/controller street E2E remains stable. |
| `ST2` Stud 8 | stud:stud8 | stud-betting-observation-v1 `16->6` | StudBettingEnv Stud8 scoop/split reward | StudBettingEnv.legal_action_mask() | synthetic Stud8 fixture dataset + future split/quartering logs | evaluate_stud_onnx.py fixture gate for ST2 | Stud8 needs odd-chip and split-pot EV gates before stronger tiers. |
| `D01` 2-7 Triple Draw | draw:low-27:triple | draw-lowball-observation-v1 `96->11` | DrawLowballEnv low-27 reward | DrawLowballEnv.legal_action_mask() | 96-slot draw transition dataset, maxDraws=3 | evaluate_draw_onnx.py fixture gate for D01 | Shared model family with S01; evaluate both triple and single draw gates. |
| `B05` Pot-Limit Omaha | board:plo | board-betting-observation-v1 `16->6` | BoardBettingEnv PLO equity / multiway isolation reward | BoardBettingEnv.legal_action_mask() | synthetic PLO fixtures + blocker/SPR real-log gate | evaluate_board_onnx.py --advanced-gate | PLO needs multiway isolation and side-pot EV gates before stronger tiers. |
| `D03` Badugi | badugi | badugi-observation-v1-ev-range `96->6` | BadugiEnv EV/range shaped reward | BadugiEnv.legal_action_mask() | Badugi 96-dim transition dataset + human/practice benchmark | evaluate_badugi_onnx.py 6-max practice gate | Beginner remains generic until a current-env beginner model clears the same safety gates. |
| `S01` 2-7 Single Draw | draw:low-27:single | draw-lowball-observation-v1 `96->11` | DrawLowballEnv low-27 reward | DrawLowballEnv.legal_action_mask() | 96-slot draw transition dataset, maxDraws=1 | evaluate_draw_onnx.py fixture gate for S01 | S01 can route shared low-27 ONNX, but long-run training should gate single-draw separately. |

## Beginner / Standard Routing

| Variant | Tier | Route | Model | Status | Asset | Shape | Short Eval | Long Run Entry |
|---|---|---|---|---|---|---|---|---|
| `B01` | beginner | variant-model | `model-nlh-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/nlh_beginner_dqn_v1.onnx --variant-id B01 --advanced-gate` | `npm run ai:train-board -- --family nlh --tier beginner --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B01` | standard | variant-model | `model-nlh-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/nlh_standard_dqn_v1.onnx --variant-id B01 --advanced-gate` | `npm run ai:train-board -- --family nlh --tier standard --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B02` | beginner | variant-model | `model-flh-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/flh_beginner_dqn_v1.onnx --variant-id B02 --advanced-gate` | `npm run ai:train-board -- --family flh --tier beginner --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B02` | standard | variant-model | `model-flh-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/flh_standard_dqn_v1.onnx --variant-id B02 --advanced-gate` | `npm run ai:train-board -- --family flh --tier standard --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B06` | beginner | variant-model | `model-plo8-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/plo8_beginner_dqn_v1.onnx --variant-id B06 --advanced-gate` | `npm run ai:train-board -- --family plo8 --tier beginner --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B06` | standard | variant-model | `model-plo8-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/plo8_standard_dqn_v1.onnx --variant-id B06 --advanced-gate` | `npm run ai:train-board -- --family plo8 --tier standard --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `ST3` | beginner | variant-model | `model-razz-beginner-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/razz_beginner_dqn_v1.onnx --variant-id ST3` | `npm run ai:train-stud -- --family razz --tier beginner --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `ST3` | standard | variant-model | `model-razz-standard-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/razz_standard_dqn_v1.onnx --variant-id ST3` | `npm run ai:train-stud -- --family razz --tier standard --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `ST1` | beginner | variant-model | `model-stud-beginner-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/stud_beginner_dqn_v1.onnx --variant-id ST1` | `npm run ai:train-stud -- --family stud --tier beginner --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `ST1` | standard | variant-model | `model-stud-standard-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/stud_standard_dqn_v1.onnx --variant-id ST1` | `npm run ai:train-stud -- --family stud --tier standard --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `ST2` | beginner | variant-model | `model-stud8-beginner-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/stud8_beginner_dqn_v1.onnx --variant-id ST2` | `npm run ai:train-stud -- --family stud8 --tier beginner --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `ST2` | standard | variant-model | `model-stud8-standard-dqn-v1` | bootstrap-active | OK | OK | `npm run ai:evaluate-stud-onnx -- --model public/models/stud8_standard_dqn_v1.onnx --variant-id ST2` | `npm run ai:train-stud -- --family stud8 --tier standard --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300` |
| `D01` | beginner | variant-model | `model-27draw-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_beginner_dqn_v1.onnx --variant-id D01` | `npm run ai:train-draw -- --family low-27 --max-draws 3 --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250` |
| `D01` | standard | variant-model | `model-27draw-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_standard_dqn_v1.onnx --variant-id D01` | `npm run ai:train-draw -- --family low-27 --max-draws 3 --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250` |
| `B05` | beginner | variant-model | `model-plo-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/plo_beginner_dqn_v1.onnx --variant-id B05 --advanced-gate` | `npm run ai:train-board -- --family plo --tier beginner --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `B05` | standard | variant-model | `model-plo-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-board-onnx -- --model public/models/plo_standard_dqn_v1.onnx --variant-id B05 --advanced-gate` | `npm run ai:train-board -- --family plo --tier standard --episodes 50000 --long-horizon --max-steps 16 --teacher-warmup-episodes 3000 --imitation-pretrain-steps 1000 --fixture-replay-copies 300` |
| `D03` | beginner | generic-fallback | `model-generic-v1` | - | POLICY | OK | `npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_standard_dqn_v3.onnx --episodes 500 --max-steps 200 --table-size 6 --feature-set badugi-observation-v1-ev-range` | `npm run ai:train-badugi -- --episodes 50000 --max-steps 200 --table-size 6 --teacher-warmup-episodes 10000 --imitation-pretrain-steps 1500 --profitable-continue-replay-ratio 0.25 --first-in-value-bet-replay-ratio 0.25` |
| `D03` | standard | variant-model | `model-badugi-standard-dqn-v3` | active | OK | OK | `npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_standard_dqn_v3.onnx --episodes 500 --max-steps 200 --table-size 6 --feature-set badugi-observation-v1-ev-range` | `npm run ai:train-badugi -- --episodes 50000 --max-steps 200 --table-size 6 --teacher-warmup-episodes 10000 --imitation-pretrain-steps 1500 --profitable-continue-replay-ratio 0.25 --first-in-value-bet-replay-ratio 0.25` |
| `S01` | beginner | variant-model | `model-27draw-beginner-dqn-v1` | active | OK | OK | `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_beginner_dqn_v1.onnx --variant-id S01` | `npm run ai:train-draw -- --family low-27 --max-draws 1 --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250` |
| `S01` | standard | variant-model | `model-27draw-standard-dqn-v1` | active | OK | OK | `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_standard_dqn_v1.onnx --variant-id S01` | `npm run ai:train-draw -- --family low-27 --max-draws 1 --episodes 50000 --teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250` |

## Blocking Issues

No blocking model-route issues detected for Beginner/Standard.

## Required Gate Order

1. `npm run test:mgx:safety`
2. `npm run ai:plan-10game-rl -- --report docs/testing/MGX_10GAME_RL_READINESS_REPORT.md`
3. Run each variant's short evaluation command from the table.
4. Only then run the long-run command for the same variant/tier.
5. Export ONNX, update checksums, run `npm run ai:verify-models`, and rerun `npm run test:rl:safety` before routing stronger tiers.

## Decision

- Beginner/Standard rollout surface: READY
- Stronger than Standard: NOT granted by this report.
- Badugi Beginner: generic fallback remains allowed until a current-env beginner DQN clears the same gates.
