# MGX RL Resume Readiness Report

Last updated: 2026-05-06

## Summary

| Item | Result |
|---|---|
| TRAINING_ALLOWED | YES, only with clean dataset validation summary |
| INFERENCE_ALLOWED | YES |
| DATASET_EXPORT_ALLOWED | YES, dirty exports are flagged and can be blocked with `--require-clean-dataset` |
| Overall Risk | MEDIUM |

## Gate Results

| Gate | Status | Blocking | Notes |
|---|---|---|---|
| GAME-GATE | PASS | No | `known-bugs`, `one-hand`, and progress suites pass. |
| SCHEMA-GATE | PASS | No | Badugi/D01/D02/S01/S02 all validate 96-slot vectors and model input shape. |
| ACTION-GATE | PASS | No | Illegal transition actions are rejected by `validateRlTransition`; live actor legality is covered by progress invariants. |
| TRANSITION-GATE | PASS | No | Transition validator requires observation/action/reward/next_observation/done/legal_actions continuity. |
| REWARD-GATE | PASS | No | Numeric reward, seat reward zero-sum, reward/stack-delta consistency, and focused EV integrity fixtures are enforced. |
| DATASET-GATE | PASS | No | `export_dataset.py` emits validation summary and can reject dirty exports. |
| FALLBACK-GATE | PASS | No | ONNX invalid shape does not silently infer; deterministic fallback returns legal safe action. |

## Variant Results

| Variant | Schema | Action | Transition | Reward | Dataset | Status |
|---|---|---|---|---|---|---|
| D03 Badugi | PASS | PASS | PASS | PASS EV guard | PASS | SAFE FOR CLEAN-DATA TRAINING |
| D01 2-7 Triple Draw | PASS | PASS | PASS | PASS EV guard | PASS | SAFE FOR CLEAN-DATA TRAINING |
| D02 A-5 Triple Draw | PASS | PASS | PASS | PASS EV guard | PASS | SAFE FOR CLEAN-DATA TRAINING |
| S01 2-7 Single Draw | PASS | PASS | PASS | PASS EV guard | PASS | SAFE FOR CLEAN-DATA TRAINING |
| S02 A-5 Single Draw | PASS | PASS | PASS | PASS EV guard | PASS | SAFE FOR CLEAN-DATA TRAINING |

## Blocking Issues

| Issue | Severity | Area | Required Fix |
|---|---|---|---|
| None for clean dataset training restart | - | - | Keep `--require-clean-dataset` enabled when using exported logs. |

## Fallback Behavior

| Case | Expected | Actual | Status |
|---|---|---|---|
| Model missing | Rule-based policy may handle; deterministic safe is last resort | Existing `onnxFallbackSmoke` covers missing session to policy router | PASS |
| Rule-based unavailable | Deterministic safe fallback | `buildDeterministicSafeDecision(["raise", "call"])` returns CALL | PASS |
| Invalid input shape | Logged failure / no silent ONNX inference | Feature builders throw, inference path returns null with warning | PASS |
| ONNX illegal action | Mask by legal action labels | Existing ONNX adapter inference test masks illegal output | PASS |
| Empty legal actions | No action | Deterministic fallback returns null | PASS |

## Dataset Validation Summary

| Total | Valid | Invalid | Training Allowed |
|---:|---:|---:|---|
| 2 fixture transitions | 1 | 1 | false for dirty fixture |

The dirty fixture intentionally contains one illegal action to prove the gate blocks corrupted data. Clean real exports must have `invalid=0`.

## Added / Updated Tests

| Test | Purpose | Status |
|---|---|---|
| `src/rl/testing/rlResumeSafetyGate.test.js` | RL resume safety gate for game/schema/action/transition/dataset/fallback | PASS |
| `src/rl/testing/validateRlTransition.js` | Shared transition validator | PASS via safety tests |
| `test:rl:safety` | Runs safety gate plus existing RL pipeline/fallback tests | PASS |

## Dataset / Training Guard

| Area | Change | Status |
|---|---|---|
| `src/rl/tools/export_dataset.py` | Adds `validation_summary` and `--require-clean-dataset` | PASS |
| `src/rl/training/train_dqn.py` | Adds `--dataset-validation-summary` and `--require-clean-dataset` guard | PASS via CLI smoke |

## Verification Commands

| Command | Result | Notes |
|---|---|---|
| `npm run test:rl:safety` | PASS | 8 files, 52 tests. Covers Badugi/D01/D02/S01/S02 progression, 96-slot schema, dataset validator, and fallback safety. |
| `npm run test:game:ev` | PASS | 1 file, 14 tests. Covers EV-001 through EV-015. |
| `npm run test:game:known-bugs` | PASS | 42 regression tests. |
| `npm run test:game:one-hand` | PASS | 53 progression guarantee tests. |
| `npm run test:game:progress` | PASS | 151 passed, 11 skipped with existing explicit reasons. |
| `npm run test:game:family` | PASS | 28 family coverage tests. |
| `python3 src/rl/tools/export_dataset.py --help` | PASS | `--require-clean-dataset` is available. |
| `.venv/bin/python src/rl/training/train_dqn.py --help` | PASS | `--dataset-validation-summary` and `--require-clean-dataset` are available. |
| `cd backend && .venv/bin/python -m pytest tests/test_badugi_rl.py tests/test_analysis_chatgpt_api.py` | PASS | 13 backend RL / feedback-related tests passed. |
| `cd backend && .venv/bin/python -m pytest` | FAIL | 32 passed, 4 failed in pre-existing non-RL areas: `test_badugi_stats_computation` and `test_variants_api.py` seed/list/detail/idempotency checks. These do not block the RL safety gate but must be fixed before treating full backend QA as green. |

## Decision

| Decision | Value | Notes |
|---|---|---|
| TRAINING_ALLOWED | YES | Only when `validation_summary.invalid=0` or env-only training is intentionally used without exported game logs. |
| INFERENCE_ALLOWED | YES | Frontend ONNX remains primary; fallback path is explicit and tested. |
| DATASET_EXPORT_ALLOWED | YES | Export is allowed; dirty exports are marked `trainingAllowed=false` and can be blocked. |

## Remaining Risks

| Risk | Severity | Next Action |
|---|---|---|
| Reward semantic consistency is fixture-backed but not yet full real-log replay | MEDIUM | Run real exported hand history through EV guard before Pro/WorldMaster promotions. |
| Python export converts missing vectors to zero vectors for compatibility | MEDIUM | Keep `--require-clean-dataset` and add stricter raw-log source validation before bulk training. |
| Full backend pytest is not green | MEDIUM | Fix stats/variant seed isolation failures before using full backend test status as a release gate. |
| Backend RL fallback API not reworked in this pass | LOW | Backend RL/feedback tests pass; keep backend as comparison/fallback only. |
