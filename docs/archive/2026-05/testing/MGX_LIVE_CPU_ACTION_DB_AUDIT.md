# MGX Live CPU Action DB Audit

Date: 2026-05-19

## Scope

This audit checks whether live/preview cash gameplay logs can prove the reported fold-heavy CPU behavior and identify the active CPU decision path.

Read-only audit output:

- `reports/ai/live-db-cpu-action-audit.json`
- `reports/ai/live-db-cpu-action-audit.md`
- `reports/ai/live-db-cpu-action-audit-v2.json`
- `reports/ai/live-db-cpu-action-audit-v2.md`

Generated reports are not committed.

## Persistence Inspection

Models and endpoints inspected:

- `backend/app/models/hand_log.py`
  - `badugi_hand_logs`
  - `badugi_hand_actions`
  - `badugi_hand_results`
- `backend/app/models/badugi_action_log.py`
  - `badugi_action_logs`
- `backend/app/api/badugi_log.py`
  - `POST /api/badugi/hands`
  - `GET /api/badugi/hands/recent`
  - `GET /api/badugi/hands/by-table/{table_id}`
  - `GET /api/badugi/hands/{hand_id}`
- `backend/app/api/badugi_actions.py`
  - `POST /api/badugi/actions/batch`
  - `GET /api/badugi/actions/recent`
- `backend/app/api/history.py`
  - generic in-memory history only; not DB-backed
- `backend/app/core/db.py`
  - SQLAlchemy engine/session configuration

Live action rows are persisted in `badugi_action_logs`. Structured hand summaries are persisted in `badugi_hand_logs`, `badugi_hand_actions`, and `badugi_hand_results`.

## DB Audit Result

The read-only audit connected to the configured backend database without exposing credentials.

Summary from `reports/ai/live-db-cpu-action-audit.json`:

| Field | Result |
| --- | --- |
| Source table | `badugi_action_logs` |
| Recent hands read | `500` |
| Action rows read | `2307` |
| CPU identity availability | `CPU_ID_MISSING_BUT_INFERABLE` |
| Decision source availability | `DECISION_SOURCE_AVAILABLE` |
| Decision source fields found | `decisionSource`, `tierId` |
| PII/token exposure | `false` |

CPU identity is not stored as a first-class boolean/type column. The audit inferred CPU actions from player identifiers/names where possible and excludes obvious hero/human actions. Unknown actions remain classified as unknown instead of being forced into CPU.

## Live Metrics

CPU-inferred plus unknown non-hero action metrics:

| Metric | Value |
| --- | ---: |
| Actions analyzed | `2092` |
| Hands represented | `498` |
| Fold rate | `35.42%` |
| VPIP proxy | `31.50%` |
| Call count | `606` |
| Raise/open count | `53` |
| Showdown/collect count | `139` |

By variant where hand metadata was available:

| Variant | Hands | Actions | Fold rate | VPIP proxy | Raise/open |
| --- | ---: | ---: | ---: | ---: | ---: |
| D01 | `48` | `256` | `33.20%` | `22.27%` | `12` |
| D02 | `29` | `108` | `29.63%` | `24.07%` | `5` |
| D03 | `109` | `890` | `42.58%` | `32.58%` | `9` |
| S01 | `40` | `97` | `22.68%` | `44.33%` | `6` |
| S02 | `6` | `22` | `4.55%` | `50.00%` | `1` |
| unknown | `266` | `719` | `30.88%` | `32.27%` | `20` |

Mode is not reliably persisted in the action rows, so cash-vs-tournament cannot be separated from DB alone today.

## Decision Source

Decision source data is only partially available:

- `pro-overlay`: `86` actions
- `unknown`: `2001` actions in the v2 read

The v2 audit also confirms the historical rows still have:

- `sessionId`: `0` rows
- `legalActions`: `0` rows
- `fallbackReason`: `0` rows
- `cpuPolicy`: `0` reliable rows

This means the DB can prove that some persisted live actions carried pro-overlay metadata, but it cannot determine the decision source for most live actions. `fallbackReason`, `legalActions`, `cpuPolicy`, and `rlUsed` are not reliably persisted.

## Persistence Update

The implementation now uses the existing `badugi_action_logs.metadata` JSON column. No migration is required.

New action metadata added for CPU decisions:

- `sessionId`
- `mode`
- `variantId`
- `actorSeat`
- `isCpu`
- `decisionSource`
- `fallbackReason`
- `legalActions`
- `selectedAction`
- `finalAction`
- `cpuPolicy`
- `aiTier`
- `street`
- `drawRound`
- `betRound`
- `toCall`
- `canRaise`
- `handStrengthBucket`

`?mgxQa=mobile` now exposes a QA session id, CPU decision summary, and CPU session export. The telemetry persistence is deployed in preview head `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`, which includes CPU telemetry commits `b75e424`, `b0b1a2e`, and `8638c79`. The next live DB audit should be run after targeted physical QA and filtered by recent rows/session id.

## Comparison to Node Sanity

Classification: `LIVE_UNKNOWN_SOURCE`.

The live DB sample is not fold-heavy overall: fold rate is `35.42%`, not close to the local pro-overlay sanity fold rates of `92.6%` to `97.3%`.

However, because decision source is missing for most actions and mode is not reliable, this does not prove the reported physical cash session used the healthy heuristic path. It only proves that the persisted recent live DB sample does not globally match the extreme pro-overlay fold-heavy pattern.

## Conclusion

`CORE5-CPU-FOLD-001` remains a P1 investigation item, but the current DB evidence does not justify an immediate CPU strategy change.

Next action should be targeted QA and DB audit by session id, not tuning:

- run `?mgxQa=mobile` cash sessions for D01/D02/Badugi
- record the visible QA session id
- export the CPU session QA JSON if fold-heavy behavior is observed
- rerun `scripts/audit-live-cpu-actions-from-db.py` against recent rows / session id
