# MGX Tournament AI Feedback Audit

Date: 2026-05-19

## Scope

This audit measures tournament gameplay quality for CPU-vs-CPU Core5 simulations. It does not change CPU strategy, RL routing, evaluator logic, or production routing.

Node-measured variants:

- D01
- D02
- S01
- S02

Gap:

- Badugi is `NOT_NODE_MEASURED` in this pass because the existing Node CPU sanity runner intentionally skips the Badugi browser/controller path. Badugi tournament AI feedback quality must be verified through browser/live telemetry and physical QA session exports.

Generated report:

- `reports/ai/tournament-ai-feedback-audit.json`

## Heuristic Result

| Metric | Value |
| --- | ---: |
| Decisions | 6,527 |
| Fold rate | 0.05% |
| Call rate | 29.54% |
| Raise rate | 7.81% |
| Open rate | 6.93% |
| Draw rate | 36.51% |
| Fallback rate | 0% |
| Legal raise spots | 4,136 |
| Raise-available-but-folded | 3 |

Classification: `CPU_REALISTIC_ENOUGH_FOR_AUDIT`

The heuristic path is not fold-heavy. If anything, it is very sticky: it folds almost never in the measured tournament simulations. That is a quality tuning topic, not a progression blocker.

## Pro-overlay Result

| Metric | Value |
| --- | ---: |
| Decisions | 2,044 |
| Fold rate | 97.75% |
| Call rate | 0.29% |
| Raise rate | 0.34% |
| Open rate | 0.20% |
| Draw rate | 0.78% |
| Fallback rate | 0% |
| Legal raise spots | 2,028 |
| Raise-available-but-folded | 1,998 |

Classification:

- `CPU_TOO_NIT`
- `CPU_TOO_PASSIVE`
- `PRO_OVERLAY_NEEDS_TUNING_LATER`

The pro-overlay path is not tournament-alpha ready as a gameplay experience. It creates too few voluntary actions and too few draw/showdown decisions. This matches the earlier fold-heavy concern more closely than the heuristic path.

## Variant Breakdown

| Variant | Mode | Fold Rate | Raise Rate | Open Rate | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| D01 | heuristic | 0.11% | 8.39% | 8.00% | playable, not fold-heavy |
| D02 | heuristic | 0.04% | 10.15% | 8.64% | most aggressive measured heuristic variant |
| S01 | heuristic | 0.00% | 3.89% | 3.65% | low aggression but not nit |
| S02 | heuristic | 0.00% | 6.66% | 5.48% | playable, not fold-heavy |
| D01 | pro-overlay | 97.28% | 0.39% | 0.19% | too nit |
| D02 | pro-overlay | 98.81% | 0.20% | 0.20% | broken as gameplay experience |
| S01 | pro-overlay | 97.65% | 0.20% | 0.20% | too nit |
| S02 | pro-overlay | 97.27% | 0.58% | 0.19% | too nit |

## Meaningful Decision Density

| CPU Path | Hands | Opportunities | Meaningful / Hand | Classification |
| --- | ---: | ---: | ---: | --- |
| heuristic | 400 | 6,516 | 16.29 | `GOOD_DECISION_DENSITY` |
| pro-overlay | 400 | 46 | 0.12 | `TOO_SHALLOW` |

## Current Quality Classification

| Area | Classification |
| --- | --- |
| Heuristic tournament CPU | playable for audit, needs later tuning |
| Pro-overlay tournament CPU | `CPU_TOO_NIT`, not alpha-ready for gameplay |
| Badugi tournament CPU | P1 confirmed in focused value-pressure audit: friend-alpha default tier routes Badugi through pro-overlay, and the current runtime adapter can collapse made-Badugi pressure to check/call |
| Tournament pacing | preset framework viable |
| Meaningful decisions | good with heuristic, poor with pro-overlay |

## Badugi Value Pressure Addendum

Date: 2026-05-20

Focused Badugi value audit report:

- `docs/ai/MGX_BADUGI_VALUE_BET_AUDIT.md`
- `reports/ai/badugi-value-bet-audit.json`
- `reports/ai/badugi-cpu-pressure-comparison.json`

Badugi comparison:

| Path | Value bet frequency | Heads-up pressure | Meaningful density | Status |
| --- | ---: | ---: | ---: | --- |
| heuristic | 100.00% | 100.00% | 66.67% | acceptable in focused value spots |
| pro-overlay runtime | 0.00% | 0.00% | 16.67% | `BADUGI_VALUE_PRESSURE_COLLAPSE` |
| fallback | 0.00% | 0.00% | 16.67% | passive safe fallback |

The Badugi finding is not an evaluator or RL-training result. It is a runtime-source/action-shape audit finding: pro-overlay returns a pressure `type`, while the current BET runtime adapter reads `action`, so the applied selected action can become passive.

## Recommendation

Do not tune AI inside this audit pass. First decide which CPU path is active for friend alpha and confirm it with deployed CPU telemetry by sessionId. If pro-overlay is active for friend-alpha tournament or cash tables, tuning should become a P1 before broad external feedback because the current pro-overlay behavior can make games feel dead.
