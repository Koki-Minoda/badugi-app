---
title: MGX Badugi Value Bet Audit
date: 2026-05-21
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
- Root cause confirmed: the previous Badugi BET adapter could lose the overlay action because the overlay returns `type`, while the runtime BET path read `action`.
- Local fix: `normalizeCpuAction()` accepts `type` as a legacy alias, normalizes it to canonical `action`, and records invalid/illegal action fallback reasons instead of silently collapsing pressure to check/call.
- This remains a runtime adapter/schema finding, not an evaluator/RL finding.

## Comparison

| Path | VPIP | PFR | Aggression | Value bet opps | Value bet freq | HU pressure freq | Meaningful density | Classification |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| heuristic | 66.67% | 66.67% | 66.67% | 3 | 100.00% | 100.00% | 66.67% | acceptable in focused value spots |
| pro-overlay runtime after normalization | 66.67% | 66.67% | 66.67% | 3 | 100.00% | 100.00% | 66.67% | local adapter collapse fixed |
| fallback | 16.67% | 0.00% | 0.00% | 3 | 0.00% | 0.00% | 16.67% | passive safe fallback |

Before normalization, the pro-overlay runtime row was `0.00%` value bet frequency, `0.00%` heads-up pressure, and `16.67%` meaningful density.

## Missed Value Classes

Pre-fix pro-overlay runtime classifications:

- `VALUE_BET_MISSED`: 3
- `PRESSURE_MISSING`: 4
- `OVER_PASSIVE_CHECK`: 3
- `TOO_NIT_SHOWDOWN_LINE`: 3
- `NO_THIN_VALUE`: 1
- `NO_HEADS_UP_PRESSURE`: 4

These are audit classifications only. They should drive the next fix/tuning plan, but this pass intentionally does not tune the AI.

Post-fix focused audit classifications for `pro-overlay` are empty in the six deterministic value-pressure scenarios. This does not prove CPU strategy strength; it only proves the adapter no longer drops valid pro-overlay pressure actions in these cases.

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
- `rawDecisionType`
- `rawDecisionAction`
- `rawActionSource`
- `sourceActionField`
- `normalizedAction`
- `normalizationWarnings`
- `legacyTypeAliasNormalized`
- `adapterMismatch`

No DB migration is required because the fields live in `badugi_action_logs.metadata`.

## Current Status

Passive behavior was confirmed for the pre-fix pro-overlay runtime adapter path in focused made-Badugi value spots.

Local adapter normalization removes that focused passive collapse in deterministic audit scenarios.

## Deploy / Live Confirmation

Date: 2026-05-21

Deploy evidence:

- `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json`
- `localHead`: `c36bc37035dc29d2f98925139199ab99031efc2e`
- `deployedCommit`: `c36bc37035dc29d2f98925139199ab99031efc2e`
- `matched`: `true`
- `health`: `{"status":"ok","env":"prod","db":"ok"}`
- Deployed bundle: `assets/index-DIVDOspv.js`

Pre-deploy local gates passed: build, AI iron/pro, RL safety, game EV, `normalizeCpuAction`, focused Badugi value-pressure regression, focused Badugi value-bet observation, and `scripts/run-badugi-value-bet-audit.js`.

Live browser evidence:

- Live invariant run reached gameplay in the Badugi cash landscape, Badugi tournament desktop, and Badugi tournament portrait rows, completing 150/150 gameplay hands with no actor P0, terminal P0, or action-application failure. Two additional startup rows failed before gameplay on live `/auth/signup` 504 and are classified as auth infrastructure, not gameplay normalization failures.
- Focused live Badugi observation passed and classified runtime as `pro-overlay`.
- Focused live observation reported `passiveConfirmed=false`, `adapterMismatchRows=0`, `typeAliasRows=0`, and `illegalNormalizationRows=0`.
- The natural focused live sample did not hit a value-bet opportunity or a pro-overlay BET pressure row carrying `rawActionSource=type`, so it cannot close the deploy gate by itself.

DB telemetry evidence:

- `reports/ai/live-db-badugi-pro-overlay-normalization-audit.json`
- Session: `qa-1779319175402-7247efc3`
- Persisted rows: 7
- `decisionSource=pro-overlay`: 2 rows, both DRAW actions.
- Unknown-source rows included one `raise` and no fallback reasons.
- No `ACTION_APPLICATION_FAILED` or illegal normalization fallback was recorded in this session.

Status: `BADUGI-CPU-VALUE-BET-001` is deployed and locally fixed, but remains `NEEDS_TARGETED_LIVE_PRESSURE_CONFIRMATION` until a live/physical session captures a legal pro-overlay BET pressure spot with `rawActionSource=type` and canonical `finalAction=raise/bet`.

## Next Action

Do not tune in this pass. Next work is a targeted live/physical telemetry run long enough to capture `decisionSource=pro-overlay`, `rawActionSource=type`, and canonical `finalAction=raise/bet` in a legal pressure spot.
