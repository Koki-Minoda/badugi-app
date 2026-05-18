# MGX Core5 CPU Strategy Sanity Audit

Date: 2026-05-18

## Scope

This audit checks whether Core5 cash-game CPU opponents are folding because of game progression errors, missing legal actions, fallback routing, or overly tight decision policy.

Variants:

- Badugi
- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

## Decision Trace Coverage

Added CPU decision telemetry and summary aggregation:

- `src/ai/qa/cpuDecisionTrace.js`
- `src/ai/qa/summarizeCpuDecisionTrace.js`
- `scripts/run-core5-cpu-vs-cpu-sanity.js`
- `src/ai/__tests__/cpuDecisionTrace.test.js`
- `src/ai/__tests__/core5CpuStrategySanity.test.js`
- `tests/e2e/core5-cpu-action-diversity.spec.ts`

Generated evidence:

- `reports/ai/core5-cpu-vs-cpu-sanity-heuristic.json`
- `reports/ai/core5-cpu-vs-cpu-sanity-rl.json`
- `reports/ai/cpu-decision-trace-heuristic.jsonl`
- `reports/ai/cpu-decision-trace-rl.jsonl`

Reports are generated artifacts and are not committed.

## Results

### Heuristic / Rule-based Draw-lowball CPU

The draw-lowball controller path does not reproduce the fold-heavy behavior.

| Variant | Hands | Decisions | Fold | Call | Raise | Open | Check | Draw | Fallback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| D01 | 100 | 1989 | 1 | 461 | 156 | 146 | 571 | 800 | 0% |
| D02 | 100 | 223 | 0 | 87 | 15 | 13 | 37 | 84 | 0% |
| S01 | 100 | 1263 | 0 | 445 | 51 | 48 | 371 | 396 | 0% |
| S02 | 100 | 1063 | 0 | 389 | 68 | 56 | 275 | 331 | 0% |

Classification: `NOT_REPRODUCED_IN_HEURISTIC_PATH`.

The rule-based controller path produces opens/raises, calls/checks, draw decisions, and showdowns. There were no illegal action rejections and no forced folds.

### `--cpu=rl` / Pro-overlay Path

The `--cpu=rl` sanity mode does not call a live RL service. It routes through the existing pro overlay and returns valid responses, but those responses are too fold-heavy in cash.

| Variant | Hands | Decisions | Fold rate | Raise rate | Open rate | Fallback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| D01 | 100 | 514 | 97.3% | 0.4% | 0.4% | 0% |
| D02 | 100 | 539 | 92.6% | 0.4% | 0.4% | 0% |
| S01 | 100 | 531 | 94.0% | 1.5% | 0.9% | 0% |
| S02 | 100 | 512 | 97.3% | 0.4% | 0.0% | 0% |

Classification:

- `CPU_STRATEGY_TOO_NIT`
- Not `RL_FALLBACK_ALWAYS_USED`
- Not `LEGAL_ACTIONS_MISSING_RAISE`
- Not `PROGRESSION_FORCES_FOLD`
- Not `RL_RESPONSE_INVALID`

## Badugi Coverage Note

The Node CPU-vs-CPU sanity runner intentionally does not import the modern Badugi browser controller because that path depends on JSX-only UI round-flow modules. Badugi CPU behavior must be confirmed through browser gameplay trace and physical QA. This is a test-harness limitation, not proof that Badugi CPU strategy is healthy.

## Root Cause Classification

Current evidence points to the pro-overlay decision policy being too tight for 6max cash draw-lowball games. The rule-based draw controller can raise/open and does not fold excessively. Legal action generation includes raise in many spots, and no illegal forced folds were observed.

Open follow-up:

- Determine whether live/preview is configured to use pro overlay or another tight policy for CPU seats.
- Add browser-level CPU decision trace for Badugi and live cash sessions.
- Tune pro-overlay/fallback only after confirming the live decision source.
