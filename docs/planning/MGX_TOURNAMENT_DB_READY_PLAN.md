# MGX Tournament DB-Ready Plan

## Current Static Sources

- `src/config/tournamentStages.js`: stage metadata, entry costs, eligibility text, payout rows, and the public `buildTournamentConfigFromStage(stageId)` adapter.
- `src/config/tournamentBlindSheets.js`: static blind sheets and blind levels.
- `src/config/tournamentUnlocks.js`: unlock tree and variant availability.
- `src/config/tournamentOpponents.js`: static opponent roster for legacy tournament sessions.
- `src/ui/tournament/tournamentManager.js`: localStorage sessions and active MTT save snapshots.
- `src/games/badugi/engine/tournamentMTT.js`: runtime MTT state transitions.

## New Domain Boundary

Sprint 7 introduces `src/tournament/domain/` as the DB-ready boundary.

- `tournamentDefinitions.js`: JSDoc domain typedefs and schema version.
- `normalizeTournamentDefinition.js`: converts static JS shapes into DB-like normalized domain objects.
- `tournamentRepository.js`: repository-style interface over the current static source.

`buildTournamentConfigFromStage(stageId)` remains the compatibility API for App/UI code, but now delegates to the static tournament repository.

## Future DB Table Candidates

- `tournament_series`
  - `id`, `name`, `variant_id`, `display_order`
- `tournament_stage`
  - `id`, `series_id`, `name`, `stage_key`, `entry_fee`, `starting_stack`, `seats_per_table`, `default_entrants`, `blind_sheet_id`, `ai_tier_id`, `unlock_condition_id`
- `tournament_venue`
  - `id`, `stage_id`, `name`, `region`, `theme_key`
- `tournament_blind_sheet`
  - `id`, `name`, `level_duration_minutes`, `break_every_levels`, `break_duration_minutes`
- `tournament_blind_level`
  - `id`, `blind_sheet_id`, `level_index`, `small_blind`, `big_blind`, `ante`, `hands_this_level`
- `tournament_payout_structure`
  - `id`, `stage_id`, `place`, `percent`, `amount`
- `tournament_unlock_condition`
  - `id`, `requires_variant_id`, `requires_stage_id`, `requires_result`, `unlocks_variant_id`, `unlocks_stage_id`
- `tournament_opponent_roster`
  - `id`, `stage_id`, `opponent_id`, `seat_weight`, `persona_key`
- `user_tournament_progress`
  - `user_id`, `variant_id`, `stage_id`, `best_finish_place`, `wins`, `updated_at`
- `user_tournament_session`
  - `id`, `user_id`, `definition_id`, `snapshot_version`, `snapshot_json`, `status`, `saved_at`

## Migration Order

1. Keep static JS as source of truth and validate it through the domain normalizers.
2. Add backend read APIs that return the same normalized domain shape.
3. Mirror static definitions into DB seed data.
4. Switch repository implementation from static source to API/DB source behind the same function names.
5. Move active localStorage MTT snapshots into `user_tournament_session` after auth/session ownership is stable.
6. Keep localStorage as offline/PWA fallback until conflict handling is designed.

## API Candidates

- `GET /api/tournaments/series`
- `GET /api/tournaments/stages`
- `GET /api/tournaments/definitions/:stageId?variantId=badugi`
- `GET /api/tournaments/blind-sheets/:blindSheetId`
- `GET /api/tournaments/unlocks`
- `GET /api/users/me/tournament-progress`
- `GET /api/users/me/tournament-session/active`
- `PUT /api/users/me/tournament-session/active`
- `DELETE /api/users/me/tournament-session/active`

## localStorage to DB Save Migration

Current active MTT save key:

```text
mgx.tournament.mtt.active
```

Migration path:

1. On login, read local active snapshot.
2. Validate `version`, `isFinished`, and hero status with the domain save validator.
3. Upload to `user_tournament_session` only if the server has no newer active session.
4. After successful upload, keep localStorage as a local cache with `serverSessionId`.
5. On resume, prefer server session when online and fall back to localStorage when offline.
