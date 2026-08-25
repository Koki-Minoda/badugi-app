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

## Implemented Persistence

No migration is included in this step. The implementation extends the existing `badugi_action_logs.metadata` JSON payload that is already accepted by `POST /api/badugi/actions/batch`.

Fields persisted inside `badugi_action_logs.metadata` for CPU action rows:

```json
{
  "sessionId": "qa-...",
  "variantId": "D01",
  "mode": "cash",
  "actorSeat": 2,
  "isCpu": true,
  "decisionSource": "heuristic|pro-overlay|rl|fallback|forced",
  "fallbackReason": null,
  "aiTier": "standard|pro|iron",
  "cpuPolicy": "standard|pro|iron|unknown",
  "legalActions": ["fold", "call", "raise"],
  "selectedAction": "call",
  "finalAction": "call",
  "street": "BET",
  "drawRound": 1,
  "betRound": 1,
  "toCall": 20,
  "canRaise": true,
  "handStrengthBucket": "unknown|trash|weak|medium|strong|premium"
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

Keep `CORE5-CPU-FOLD-001` open as P1 until a deployed targeted physical/browser cash session persists explicit CPU decision source and is audited by sessionId. Keep `CORE5-CPU-TELEMETRY-001` as P2 / needs deploy + targeted QA until the new fields appear in live DB rows.

QA flow:

1. Open `https://mgx-poker.com/?mgxQa=mobile`.
2. Record the visible QA session id.
3. Play D01 cash, D02 cash, and Badugi cash for roughly 20 hands each.
4. Export the CPU session report if play feels fold-heavy.
5. Run `scripts/audit-live-cpu-actions-from-db.py --limit-hands 500 --output reports/ai/live-db-cpu-action-audit-v2.json`.
6. Compare the session rows by `decisionSource`, `legalActions`, and `raiseAvailableButFolded`.
