# MGX RL 8/10Game Beginner-Standard Training Ledger

Date: 2026-05-06

Scope: 8Game / 10Game 対象variantの Beginner / Standard CPU に、現時点で利用可能なONNX DQNまたは既存RL routingがあるかを確認する。Stud系は実ゲーム進行監査が継続中のため、今回のモデルは Pro/Iron 相当ではなく `bootstrap-active` として扱う。

| Variant | Mixed Usage | Family | Beginner Model | Standard Model | Training Source | Gate | Status | Next Action |
|---|---|---|---|---|---|---|---|---|
| `B01` NL Hold'em | 8Game / 10Game | Board | `model-nlh-beginner-dqn-v1` | `model-nlh-standard-dqn-v1` | Synthetic board long-horizon DQN | board advanced fixture + human/practice EV gate | Active bootstrap | 実ログを増やし、Pro昇格時はworst-position/showdown/all-in gateを必須にする |
| `B02` FL Hold'em | HORSE / 8Game / 10Game | Board | `model-flh-beginner-dqn-v1` | `model-flh-standard-dqn-v1` | Synthetic board long-horizon DQN | board advanced fixture pass | Active bootstrap | fixed-limit cap/crying callを実ログで評価 |
| `B05` PLO | 8Game / 10Game | Board | `model-plo-beginner-dqn-v1` | `model-plo-standard-dqn-v1` | Synthetic board long-horizon DQN | board advanced fixture + all-in EV gate | Active bootstrap | multiway isolation / SPR / blockerの実ログEVを蓄積する |
| `B06` PLO8 | HORSE / 8Game / 10Game | Board split | `model-plo8-beginner-dqn-v1` | `model-plo8-standard-dqn-v1` | Synthetic board long-horizon DQN | board advanced fixture + split-pot EV gate | Active bootstrap | scoop/no-low / quartering / split-pot EVを実ログで検証する |
| `D01` 2-7 Triple Draw | 8Game / 10Game | Draw lowball | `model-27draw-beginner-dqn-v1` | `model-27draw-standard-dqn-v1` | 96-slot draw DQN | draw ONNX fixture pass | Active bootstrap | Pro以上、snow/final street discipline |
| `D03` Badugi | 10Game | Badugi | generic beginner fallback | `model-badugi-standard-dqn-v3` | 96-dim Badugi DQN | synthetic + practice gate | Standard active | Beginner専用再学習、Iron/WorldMaster |
| `S01` 2-7 Single Draw | 10Game | Draw lowball | `model-27draw-beginner-dqn-v1` | `model-27draw-standard-dqn-v1` | 96-slot draw DQN shared with D01 | draw ONNX fixture pass | Active bootstrap | single draw専用gate |
| `ST1` Stud | HORSE / 8Game / 10Game | Stud | `model-stud-beginner-dqn-v1` | `model-stud-standard-dqn-v1` | Synthetic Stud bootstrap DQN | 5/5 ONNX fixture pass | Active bootstrap | bring-in/complete/7th street実ログgate |
| `ST2` Stud Hi-Lo | HORSE / 8Game / 10Game | Stud split | `model-stud8-beginner-dqn-v1` | `model-stud8-standard-dqn-v1` | Synthetic Stud bootstrap DQN | 5/5 ONNX fixture pass | Active bootstrap | split/quartering/odd chip実ログgate |
| `ST3` Razz | HORSE / 8Game / 10Game | Stud lowball | `model-razz-beginner-dqn-v1` | `model-razz-standard-dqn-v1` | Synthetic Stud bootstrap DQN | 5/5 ONNX fixture pass | Active bootstrap | low board pressure / complete判断を実ログgate |

## Stud Bootstrap Runs

| Family | Variant | Tier | Episodes | Avg Reward Last 100 | ONNX | Fixture Gate |
|---|---|---|---:|---:|---|---|
| Stud | `ST1` | Beginner | 1,600 | 0.6374 | `public/models/stud_beginner_dqn_v1.onnx` | 5/5 pass |
| Stud | `ST1` | Standard | 1,600 | 0.5973 | `public/models/stud_standard_dqn_v1.onnx` | 5/5 pass |
| Stud8 | `ST2` | Beginner | 1,600 | 0.6659 | `public/models/stud8_beginner_dqn_v1.onnx` | 5/5 pass |
| Stud8 | `ST2` | Standard | 1,600 | 0.7056 | `public/models/stud8_standard_dqn_v1.onnx` | 5/5 pass |
| Razz | `ST3` | Beginner | 1,600 | 0.5562 | `public/models/razz_beginner_dqn_v1.onnx` | 5/5 pass |
| Razz | `ST3` | Standard | 1,600 | 0.5628 | `public/models/razz_standard_dqn_v1.onnx` | 5/5 pass |

## Verification

| Command | Result | Notes |
|---|---|---|
| `npm run ai:train-stud` | PASS | `stud/stud8/razz` x `beginner/standard` を各1,600 episodesで学習 |
| `npm run ai:export-stud-onnx` | PASS | 6 ONNX assets exported and registry checksums updated |
| `npm run ai:evaluate-stud-onnx` | PASS | 6 models, each 5/5 fixture pass |
| `npm test -- src/ai/__tests__/onnxPolicyAdapter.test.js src/ai/__tests__/modelRouter.test.js` | PASS | 17 tests |
| `npm run ai:verify-models` | PASS | Required assets OK; existing optional generic/worldmaster assets remain missing |
| `npm run test:rl:pipeline` | PASS | 6 files / 37 tests |
| `npm run test:game:known-bugs` | PASS | 1 file / 18 tests |
| `npm run test:game:family` | PASS | 4 files / 26 tests |
| `npm run build` | PASS | Existing chunk-size warning only |
| `PYTHONPATH=src .venv/bin/python -m pytest src/rl/__tests__/test_board_human_practice.py` | PASS | AI-BOARD-05: worst position EV / showdown EV / all-in EV / PLO8 split-pot sample gate |
| `npm run ai:benchmark-board-human-practice -- --model public/models/nlh_standard_dqn_v1.onnx --variant-id B01 --tier standard --human-log /tmp/mgx_board_human_gate_nlh.jsonl --require-human-logs --report /tmp/mgx_board_human_gate_report.json --json` | PASS | Synthetic human-log fixture: position/showdown/all-in EV gate passes |

## Remaining Risk

- Stud系のDQNは実ゲームhand historyからのEV学習ではなく、synthetic fixture bootstrapである。
- Board系は実ログEV gateを追加したが、現状のPASS確認はsynthetic human-log fixture。実ユーザーの長期hand historyが集まるまではPro以上へ昇格しない。
- Stud / Stud8 / Razz の進行監査は継続対象。bring-in / complete / 7th down card / all-in runout の実ログgateが揃うまでは Pro以上に昇格しない。
- Badugi Beginner は意図的に generic fallbackのまま。Beginner専用DQNを戻す場合は、現行評価・draw交換・final value bet bug修正後の再学習が必要。
