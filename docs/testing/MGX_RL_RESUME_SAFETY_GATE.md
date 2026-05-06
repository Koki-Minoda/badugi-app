# MGX RL Resume Safety Gate

Last updated: 2026-05-06

This gate defines when Badugi/Draw RL training, dataset export, and ONNX inference may resume. The current canonical observation shape is 96 slots for Badugi and Draw variants. Frontend ONNX is the primary inference path; backend `/api/badugi/rl/decision` remains a comparison/fallback path.

## Gate Matrix

| Gate ID | Area | Condition | Required Result | Status | Notes |
|---|---|---|---|---|---|
| GAME-GATE-001 | Progression | `npm run test:game:known-bugs` | PASS | PASS | 42 regression tests pass. |
| GAME-GATE-002 | Progression | `npm run test:game:one-hand` | PASS | PASS | 36 runnable variants complete one controller/action-path hand. |
| GAME-GATE-003 | Progression | Badugi / D01 / D02 / S01 / S02 one-hand progression | PASS | PASS | Covered by `rlResumeSafetyGate.test.js` through `runOneHandProgression`. |
| GAME-GATE-004 | Progression | actor null / draw rollback / all-in freeze | No regression | PASS | Covered by known-bugs, one-hand, and draw source tests. |
| SCHEMA-GATE-001 | Schema | Badugi vector shape | 96 finite values | PASS | `BADUGI_OBSERVATION_VECTOR_SIZE=96`. |
| SCHEMA-GATE-002 | Schema | Draw vector shape | 96 finite values | PASS | `DRAW_OBSERVATION_VECTOR_SIZE=96`. |
| SCHEMA-GATE-003 | Schema | Badugi/Draw model input shape | `[96]` for D03/D01/D02/S01/S02 | PASS | Checked via model registry and ONNX feature builders. |
| SCHEMA-GATE-004 | Schema | NaN / undefined / null / Infinity | Rejected | PASS | Validator and schema tests reject non-finite values. |
| ACTION-GATE-001 | Action | selected action in `legalActions` | Required | PASS | `validateRlTransition` rejects illegal actions. |
| ACTION-GATE-002 | Action | phase/action consistency | Required | PARTIAL | Dataset validator checks action legality; live actor phase checks are in game progress invariants. |
| TRANSITION-GATE-001 | Transition | observation/action/next_observation continuity | Required | PASS | Validator requires both 96-slot vectors and boolean `done`. |
| TRANSITION-GATE-002 | Transition | same-state loop detection | Required | PASS | Progression harness and E2E helper detect repeated frozen states. |
| REWARD-GATE-001 | Reward | finite numeric reward | Required | PASS | Validator rejects missing/non-finite rewards. |
| REWARD-GATE-002 | Reward | winner/loser sign consistency | Required | PARTIAL | Current gate checks numeric reward; semantic reward audit remains hand-history dependent. |
| DATASET-GATE-001 | Dataset | `export_dataset.py` emits validation summary | Required | PASS | `validation_summary` now includes total/valid/invalid/reasons/trainingAllowed. |
| DATASET-GATE-002 | Dataset | dirty dataset can block export/training | Required | PASS | `--require-clean-dataset` blocks export; `train_dqn.py` blocks when summary is dirty. |
| DATASET-GATE-003 | Dataset | variantId / schemaVersion / source marker | Required | PASS | JS validator requires them. Python export records variant and warnings; source marker is required at JS validator boundary. |
| FALLBACK-GATE-001 | Fallback | ONNX -> rule-based -> deterministic safe order | Required | PASS | Existing adapter and smoke tests keep priority explicit. |
| FALLBACK-GATE-002 | Fallback | invalid shape does not silently infer | Required | PASS | Feature builders throw; inference returns null with warning. |
| FALLBACK-GATE-003 | Fallback | fallback action remains legal | Required | PASS | Deterministic fallback prefers legal call/check/fold paths. |

## Training Stop Lines

`TRAINING_ALLOWED=NO` if any of the following occurs:

| Stop Line | Current Guard |
|---|---|
| observation shape mismatch | `validateRlTransition`, schema tests, ONNX feature builders |
| non-finite vector value | `validateRlTransition`, schema tests |
| action not in legal actions | `validateRlTransition`, `export_dataset.py` summary |
| reward missing/non-finite | `validateRlTransition` |
| non-terminal missing `next_observation` | `validateRlTransition` |
| variantId missing | `validateRlTransition`, `export_dataset.py` warning |
| D01/D02/S01/S02 feature slot mix-up | Draw schema tests and RL resume safety gate |
| invalid shape silent fallback | ONNX adapter tests and RL resume safety gate |
| dirty dataset with clean requirement | `export_dataset.py --require-clean-dataset`, `train_dqn.py --require-clean-dataset` |

## Commands

| Command | Purpose | Expected |
|---|---|---|
| `npm run test:rl:safety` | RL safety gate, schema, fallback, and pipeline tests | PASS |
| `npm run test:game:known-bugs` | Progression regression stop line | PASS |
| `npm run test:game:one-hand` | Controller progression stop line | PASS |
| `npm run test:game:progress` | Broader game progress stop line | PASS |
| `python3 src/rl/tools/export_dataset.py --help` | Dataset export CLI availability | PASS |
| `.venv/bin/python src/rl/training/train_dqn.py --help` | Training guard CLI availability | PASS |
| `cd backend && .venv/bin/python -m pytest tests/test_badugi_rl.py tests/test_analysis_chatgpt_api.py` | Backend RL/fallback-adjacent verification | PASS |
| `cd backend && .venv/bin/python -m pytest` | Full backend suite | FAIL outside RL gate: Badugi stats and variant API seed/list checks |
