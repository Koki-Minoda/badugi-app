# P2P multi-process operations

## Runtime contract

- All backend workers must use the same production database. A local SQLite
  file is supported for deterministic QA only; production multi-host use
  requires the existing shared MySQL/PostgreSQL database.
- `p2p_room_states` remains the authoritative private snapshot and command
  receipt store. `p2p_state_read_limits` holds only user ID, room code and
  bounded counters; it never stores cards or access tokens.
- Commands use an atomic sequence compare-and-swap. A conflict reloads the
  newest snapshot and re-evaluates `commandId`, `handId` and `expectedPhase`.
- Cross-process socket delivery polls all locally connected room codes in one
  query every 250 ms. REST polling remains the transport fallback.

## Safe rollout

1. Keep the backend at one worker and take the normal database backup.
2. Run `alembic upgrade 20260831_01` once, before starting the new application.
   Do not let multiple fresh workers race to bootstrap an empty database.
3. Deploy the new application with one worker. Verify `/api/health`, an
   unauthenticated P2P state request returns 401, authenticated state returns
   `Cache-Control: private, no-store`, and one two-player room completes.
4. Increase to two workers. Run the multiprocess E2E gate, including restart,
   mixed WebSocket/REST transport, ten hands and owner closure.
5. Increase further only after database query latency and 429 rate are stable.
   Fan-out cost is one batched query per active worker every 250 ms, not one
   query per room.

## Rollback

1. Drain or stop accepting new Friend Match rooms, then reduce to one worker.
2. Roll back the application revision. The previous durable-room version can
   read `p2p_room_states`; the added rate-limit table is additive and may stay.
   Existing rooms remain recoverable, but cross-process fan-out is unavailable
   after rollback, which is why worker count must be one first.
3. Verify health, authentication rejection and one existing room before
   reopening room creation.
4. Do **not** downgrade the migration during an application rollback. Drop
   `p2p_state_read_limits` only in a separate maintenance window after all new
   workers are gone. Never drop `p2p_room_states` while active or recoverable
   rooms exist.

## Stop conditions

Return to one worker if sequence conflicts persist after client retry, socket
fan-out exceeds one second, database lock time rises materially, private state
lacks `no-store`, or owner closure does not terminate the remote worker's
socket/polling session.
