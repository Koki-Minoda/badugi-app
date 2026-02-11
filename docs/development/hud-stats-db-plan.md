# HUD Stats DB Plan (MVP)

## Canonical action source
- Use `recordActionToLog` entries (ActionLog) as the canonical per-action feed.
- Each entry should include: `handId`, `playerId`, `seat`, `phase`, `round`, `action`, `betBefore/After`, `paid`, `toCall`, `ts`.

## Minimal fields for VPIP/PFR/AF (Badugi)
- `hand_id`
- `player_id`
- `seat_index`
- `phase` and `round` (BET#0 = pre-draw)
- `action_type_normalized`
- `paid`
- `to_call`
- `is_forced` (blind/ante)
- `ts` or `seq`

## Minimal schema additions
- `players`:
  - `id`, `user_id` (nullable), `name`, `type` (human/cpu), `cpu_tier`, `created_at`, `updated_at`
- `hand_participants`:
  - `id`, `hand_log_id`, `player_id`, `seat_index`, `start_stack`, `end_stack`, `folded`, `all_in`, `is_winner`
- Extend `badugi_hand_actions`:
  - `street_round`, `action_type_normalized`, `paid`, `to_call`, `is_forced`, `stack_before`, `stack_after`, `bet_before`, `bet_after`, `seq`, `ts`, `metadata`
- Optional `player_stats_agg`:
  - `player_id`, `mode`, `hands`, `vpip`, `pfr`, `af_bet_raise`, `af_calls`, `updated_at`

## Migration plan (outline)
1. Add new models in `backend/app/models/`.
2. Generate Alembic revision with new tables/columns.
3. Backfill `player_id` for existing actions (if needed).
4. Update ingestion to write normalized fields.
