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
| Badugi tournament CPU | P1 deployed adapter fix / targeted live confirmation required: friend-alpha default tier routes Badugi through pro-overlay; focused adapter normalization preserves valid pro-overlay `type` pressure actions as canonical `action`, deploy commit matches local head, but the latest natural live sample did not capture a pro-overlay BET pressure row with `rawActionSource=type` |
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
| pro-overlay runtime before normalization | 0.00% | 0.00% | 16.67% | `BADUGI_VALUE_PRESSURE_COLLAPSE` |
| pro-overlay runtime after normalization | 100.00% | 100.00% | 66.67% | local adapter collapse fixed |
| fallback | 0.00% | 0.00% | 16.67% | passive safe fallback |

The Badugi finding is not an evaluator or RL-training result. It is a runtime-source/action-shape audit finding: pro-overlay returns a pressure `type`, while the previous BET runtime adapter read `action`, so the applied selected action could become passive. The local adapter now normalizes `type -> action` and records invalid/illegal action fallback reasons.

## Badugi Deploy / Live Addendum

Date: 2026-05-21

The Badugi pro-overlay normalization fix is deployed to preview and the live frontend build matches local head `c36bc37035dc29d2f98925139199ab99031efc2e`. Evidence:

- `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json`
- `reports/ai/badugi-value-bet-live-observation.json`
- `reports/ai/live-db-badugi-pro-overlay-normalization-audit.json`

The focused live browser observation passed, classified the runtime as `pro-overlay`, and reported no adapter mismatches or illegal normalization rows. DB telemetry for session `qa-1779319175402-7247efc3` persisted `decisionSource=pro-overlay` rows and no fallback reasons. However, those pro-overlay rows were DRAW actions; the live sample did not naturally capture a value-pressure BET row with legacy `type` input and canonical `finalAction=raise/bet`.

This narrows the risk but does not close the broader pro-overlay tournament CPU realism row. Keep `CPU-TOO-NIT-001` and `MEANINGFUL-DECISION-001` open until targeted live/physical telemetry captures pressure opportunities and enough meaningful-decision density on the deployed path.

## Recommendation

Do not tune AI inside this audit pass. First capture targeted live pressure telemetry by sessionId. If pro-overlay remains globally too nit after schema normalization is proven live in BET pressure spots, that is a separate P1 tuning problem; do not mix it with this Badugi action-shape bug.
