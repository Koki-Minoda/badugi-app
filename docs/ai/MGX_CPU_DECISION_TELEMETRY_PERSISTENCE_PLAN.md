# MGX CPU Decision Telemetry Persistence Plan

Date: 2026-05-18

## Problem

Live DB action logs are sufficient for broad action counting, but not sufficient to prove which CPU policy produced each live cash action.

Current gaps:

- CPU identity is inferred, not explicit.
- Mode is not reliably stored per action.
- Variant is sometimes available through hand metadata, not guaranteed per action.
- Most actions do not persist `decisionSource`.
- `fallbackReason`, `legalActions`, `cpuPolicy`, `aiTier`, and `rlUsed` are missing or sparse.

## Minimal Persistence Proposal

No migration is included in this step. The lowest-risk future change is to extend existing action metadata JSON, not add new required columns.

Recommended fields inside `badugi_action_logs.metadata`:

```json
{
  "variantId": "D01",
  "mode": "cash",
  "isCpu": true,
  "decisionSource": "heuristic|pro-overlay|rl|fallback|forced",
  "fallbackReason": null,
  "aiTier": "standard|pro|iron",
  "legalActions": ["fold", "call", "raise"],
  "legalActionsCount": 3,
  "selectedAction": "call",
  "finalAction": "call",
  "policyVersion": "core5-cpu-v1"
}
```

Do not persist:

- raw private cards unless already part of an existing hand-history contract
- full state vectors
- access tokens
- personal identifiers beyond existing masked/player IDs

## Audit Queries Enabled by This

With those fields, live audits can separate:

- live heuristic vs pro-overlay vs fallback fold rates
- legal raise spots where CPU folded
- fallback rate by variant/mode
- cash-only vs tournament-only CPU behavior
- physical-session-specific CPU behavior without exposing PII

## Current Recommendation

Keep `CORE5-CPU-FOLD-001` open as P1 until live browser/physical sessions persist explicit CPU decision source. Add `CORE5-CPU-TELEMETRY-001` as P2 because the lack of explicit telemetry blocks fast diagnosis but does not itself break gameplay.
