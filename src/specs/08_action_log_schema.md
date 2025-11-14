# Spec 08 - Action Log / JSONL Schema

## Motivation
Bug-08 tracked that only the final outcome of a hand was preserved. With the new schema, every BET / DRAW / SHOWDOWN event is captured so RL tooling and debuggers can replay a hand step-by-step.

## Entry Shape

Each action is stored as a JSON object with the following required fields:

| Field | Type | Notes |
| --- | --- | --- |
| `phase` | `"BET" | "DRAW" | "SHOWDOWN"` | Indicates which engine phase produced the action. |
| `round` | number | For BET this matches `currentBetRoundIndex()`, for DRAW it's `drawRound + 1`, and for SHOWDOWN we reuse the final draw index. |
| `seat` | number or `null` | Seat index (0-based). `null` is used for table-level events. |
| `seatName` | string | Human-readable label (`Seat 3`, `TABLE`, etc.). |
| `action` | string | Display text such as `Call`, `Raise`, `Pat`, `DRAW(2)`, `Collect 40`. |
| `stackBefore` / `stackAfter` | number | Player stack before/after the action. |
| `betBefore` / `betAfter` | number | Bet committed on the current street before/after the action. |
| `potAfter` | number | Total chips in pots plus current street contributions after the action. |
| `raiseCountTable` | number or `undefined` | Present for BET actions to track 5-bet caps. |
| `metadata` | object or `undefined` | Extra structured data (e.g., `drawInfo`, `winners`). |
| `ts` | number | Epoch milliseconds (used for ordering when phases tie). |

### Draw Metadata
`metadata.drawInfo` is present for all draw actions and contains:
- `drawCount`
- `replacedCards` (array of `{ index, oldCard, newCard }`)
- `before` (array of card strings)
- `after` (array of card strings)

### Showdown Metadata
Showdown payouts add:
- `potIndex`
- `potAmount`
- `payout`
- `winners` (string array)

## Storage
`utils/history_rl.js` continues to append newline-delimited JSON (`JSONL`). The export is an opaque dump of all entries, ready for ingestion by notebooks or dashboards.

## Validation
- When extending the schema, update this spec, `docs/bug_fixes.md`, and `docs/bug_fixes_instructions.md`.
- Prefer adding new nested fields under `metadata` so older consumers can ignore them gracefully.

