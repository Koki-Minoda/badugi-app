# MGX RL Data Pipeline Audit Report

Audit date: 2026-05-06

## Summary

| Item | Result |
|---|---|
| TRAINING_ALLOWED | YES, with source restrictions |
| Overall Risk | MEDIUM |
| Critical Issues | 0 open after patch |
| Non-critical Issues | 4 |

Training is allowed for current Badugi / D01 / D02 / S01 / S02 schema-compatible data **only if** the dataset passes the new transition audit checks. Env-derived bootstrap data and real hand-log data must retain source/variant metadata and should not be silently merged for final strength claims.

## Critical Issues

| Issue | Status | Notes |
|---|---|---|
| Draw action could export as raw `draw` instead of `draw_N` | Fixed | `export_dataset.py` now normalizes draw/pat actions from draw metadata |
| top-level `variantId` could be missed by exporter metadata | Fixed | exporter now reads metadata and top-level variant fields |
| exported transitions had no warning channel for corruption signals | Fixed | exporter now attaches `metadata.warnings` |

## Non-critical Issues

| Issue | Risk | Notes |
|---|---|---|
| D03 beginner tier can route to generic 64-slot model | Medium | Existing behavior appears intentional for non-DQN beginner; D03-specific live ONNX tiers remain 96 |
| `recordActionToLog` does not guarantee every action carries `stateVector` | Medium | exporter pads missing vectors; training should reject records with warning or missing source vector when strict training is used |
| Env reward differs from real-game chip EV | Medium | acceptable for bootstrap, not for human-strength proof |
| Human benchmark storage is Badugi-focused | Medium | D01/D02/S01/S02 human/practice benchmark should be added before higher-tier claims |

## Pipeline Ledger

| Area | Status | Risk | Notes |
|---|---|---|---|
| Badugi observation schema | PASS | Low | 96 finite slots verified |
| Draw observation schema | PASS | Low | D01/D02/S01/S02 96 finite slots verified |
| ONNX feature builders | PASS | Low | exact-shape tensors verified |
| Model registry | PASS | Medium | Badugi/Draw specific entries are 96; generic fallback is 64 |
| Tier routing | PASS | Low | variant-specific entries selected for target tiers |
| Backend fallback API | PASS | Low | pytest validates 96-dim and schema v1 |
| Dataset export | PASS after patch | Medium | transition shape/action/variant checks added |
| `badugi_env.py` | PASS with caveat | Medium | shape aligned; mechanics simplified |
| D01/D02/S01/S02 | PASS | Low | lowball family slots and draw rounds verified |

## Schema Validation

| Variant | Expected Shape | Actual Shape | Status | Notes |
|---|---:|---:|---|---|
| D03 Badugi | 96 | 96 | PASS | Badugi vector + ONNX tensor |
| D01 2-7 Triple Draw | 96 | 96 | PASS | low-27 slot, maxDrawRounds 3 |
| D02 A-5 Triple Draw | 96 | 96 | PASS | low-a5 slot, maxDrawRounds 3 |
| S01 2-7 Single Draw | 96 | 96 | PASS | low-27 slot, maxDrawRounds 1 |
| S02 A-5 Single Draw | 96 | 96 | PASS | low-a5 slot, maxDrawRounds 1 |

## Dataset Validation

| Check | Status | Risk | Notes |
|---|---|---|---|
| observation exists | PASS | Low | audit fixture exports 96 slots |
| next_observation exists | PASS | Low | terminal transition still receives 96-slot fallback vector |
| reward numeric | PASS | Low | explicit reward preserved |
| done boolean | PASS | Low | transition exporter emits boolean |
| legal_actions exists | PASS | Low | explicit legal actions preserved |
| action is legal | PASS after patch | Low | `DRAW` normalizes to `draw_5` |
| variant source preserved | PASS after patch | Low | top-level `variantId` is preserved |
| drawCount / discardIndexes consistency | PASS | Low | mismatch generates warning |

## ONNX / Fallback Validation

| Check | Status | Risk | Notes |
|---|---|---|---|
| model available uses ONNX | PASS | Low | existing adapter inference tests cover session path |
| model missing returns null for caller fallback | PASS | Low | existing tests cover missing session |
| invalid shape is not silent | PASS | Low | builder throws; inference logs warning and returns null |
| fallback priority exposed | PASS | Low | ONNX -> ruleBased -> deterministicSafe |
| D01/D02/S01/S02 routing | PASS | Low | model entries resolve by variant and tier |

## Env Difference

| Area | Difference | Training Risk | Action |
|---|---|---|---|
| Betting mechanics | env is simplified versus production controller | Medium | treat env data as synthetic/bootstrap |
| Multiway behavior | opponent table is abstracted | Medium | require real-log benchmark before promotion |
| Reward | shaped reward differs from pure chip EV | Medium | never claim human strength from env gate alone |
| Observation | 96-dim aligned | Low | keep schema tests |

## Added / Updated Tests

| Test | Purpose | Status |
|---|---|---|
| `src/rl/__tests__/rlDataPipelineAudit.test.js` | Badugi/Draw schema, model routing, ONNX tensor, transition export corruption guard | PASS |
| `src/rl/tools/export_dataset.py` patch | Normalize draw action, preserve variant, add warning flags | PASS |

## Verification Commands

| Command | Result | Notes |
|---|---|---|
| `npx vitest run src/rl/__tests__/rlDataPipelineAudit.test.js` | PASS | 6 tests |
| `npm run test:rl:pipeline` | PASS | 6 files, 35 tests |
| `npm run test:game:known-bugs` | PASS | 18 tests |
| `npm run test:game:family` | PASS | 26 tests |
| `npm run test:game:progress` | PASS | 71 passed, 12 skipped |
| `npm test` | PASS | 131 files, 882 passed, 12 skipped |
| `cd backend && pytest tests/test_badugi_rl.py` | PASS | 4 tests |
| `cd backend && pytest` | FAIL | Existing non-RL failures in `tests/test_badugi_stats.py` and `tests/test_variants_api.py`; RL fallback API tests passed |
| `git diff --check` | PASS | No whitespace errors |

## Remaining Risks

| Risk | Severity | Next Action |
|---|---|---|
| Live `recordActionToLog` callers may omit `stateVector` | Medium | Add strict export mode or runtime warning counter before using production logs for training |
| D01/D02/S01/S02 human benchmark is not yet equivalent to Badugi | Medium | Extend human benchmark storage beyond Badugi |
| Backend fallback only supports Badugi schema endpoint | Low | Keep as comparison path; do not route production CPU through backend |
| Board-game RL uses 16-slot board schema and is outside this 96-dim Draw audit | Low | Audit separately under board RL pipeline |
