---
title: MGX Badugi Value Bet Audit
date: 2026-05-20
---

# MGX Badugi Value Bet Audit

## Scope

This is an audit-only pass. It does not change Badugi evaluator logic, RL learning, GTO strategy, CPU strength tuning, bluff frequency, or aggression thresholds.

The audit answers two questions:

- Which CPU decision path is active in friend-alpha style runtime?
- Does Badugi value/aggression pressure collapse in made-Badugi spots?

Generated reports:

- `reports/ai/badugi-value-bet-audit.json`
- `reports/ai/badugi-cpu-pressure-comparison.json`
- `reports/ai/badugi-value-bet-live-observation.json`

## Runtime Path Finding

MGX default CPU tier is `pro`. Badugi BET runtime calls the pro overlay when that tier is active.

The audit separates:

- `rawAction`: what the pro-overlay strategy indicates.
- `selectedAction`: what the current runtime adapter actually applies.

Current finding:

- `pro-overlay` is the friend-alpha default path unless a dev override changes tier.
- The current Badugi BET adapter can lose the overlay action because the overlay returns `type`, while the runtime BET path reads `action`.
- This creates a pro-overlay runtime adapter classification, not an evaluator/RL finding.

## Comparison

| Path | VPIP | PFR | Aggression | Value bet opps | Value bet freq | HU pressure freq | Meaningful density | Classification |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| heuristic | 66.67% | 66.67% | 66.67% | 3 | 100.00% | 100.00% | 66.67% | acceptable in focused value spots |
| pro-overlay runtime | 16.67% | 0.00% | 0.00% | 3 | 0.00% | 0.00% | 16.67% | passive collapse confirmed |
| fallback | 16.67% | 0.00% | 0.00% | 3 | 0.00% | 0.00% | 16.67% | passive safe fallback |

## Missed Value Classes

Current pro-overlay runtime classifications:

- `VALUE_BET_MISSED`: 3
- `PRESSURE_MISSING`: 4
- `OVER_PASSIVE_CHECK`: 3
- `TOO_NIT_SHOWDOWN_LINE`: 3
- `NO_THIN_VALUE`: 1
- `NO_HEADS_UP_PRESSURE`: 4

These are audit classifications only. They should drive the next fix/tuning plan, but this pass intentionally does not tune the AI.

## Telemetry Fields

Badugi CPU action metadata now preserves these audit fields inside the existing JSON metadata payload:

- `handStrengthBucket`
- `madeBadugi`
- `patState`
- `drawCount`
- `streetStrengthEstimate`
- `aggressionOpportunity`
- `valueBetOpportunity`
- `showdownEquityBucket`

No DB migration is required because the fields live in `badugi_action_logs.metadata`.

## Current Status

Passive behavior is confirmed for the pro-overlay runtime adapter path in focused made-Badugi value spots.

Friend-alpha runtime path is not acceptable if it remains on this pro-overlay adapter behavior. Heuristic is acceptable for this audit surface, but that is not a strength endorsement; it only means the focused value-pressure collapse is not reproduced there.

## Next Action

Do not tune in this pass. Next work should fix or explicitly classify the runtime adapter/action-shape mismatch first, then rerun live telemetry by sessionId before any aggression or strategy tuning.
