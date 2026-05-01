# P2P Session Model

This document fixes the MVP persistence boundary for MGX friend matches.

## Scope

The first playable P2P slice is a private Badugi room:

- Host creates a room from Friend Match.
- Host is joined automatically.
- Guest joins by room code.
- Both clients connect to `/ws/room/{roomId}/play`.
- Server broadcasts `room_state`, `secure_deal`, `updated_state`, `showdown`, `history`, and `error`.

Public lobbies, invite links, reconnect recovery, result sync, and spectator mode remain follow-up items.

## Server State

The current in-memory room state is the runtime source of truth during MVP:

- `rooms.id`
- `players`
- `spectators`
- `phase`
- `metadata`
- `sequence_id`
- `history`
- `hand_id`
- `stacks`
- `bets`
- `pot`
- `turn_order`
- `current_turn_index`
- `folded`
- `anti_cheat_warnings`

Persistence target for a DB-backed version:

- `p2p_rooms`: room lifecycle, mode, variant, owner, phase, max players.
- `p2p_room_participants`: player/spectator membership, seat, ready, last seen.
- `p2p_room_events`: append-only event log with sequence id, hand id, event type, payload.
- `p2p_room_snapshots`: compact latest state for reconnect and fast load.
- `p2p_match_results`: finished hand/match result for rating and RL export.

## Conflict Rules

- Server-assigned `sequenceId` is authoritative.
- Client must ignore stale events whose `sequenceId` is lower than the latest applied sequence.
- Client may keep observing events before full table sync is wired, but must not mutate the local Badugi engine from P2P events until conflict handling is implemented.
- Reconnect must request latest room info plus recent history before resuming actions.

## Current Implementation Status

- REST room create/join/info/list exists under `/api/rooms`.
- WebSocket skeleton exists under `/ws/room/{roomId}/play`.
- Friend Match can create a room, auto-join host, join by room code, and display received sync events.
- Actual game table synchronization is intentionally not connected yet.
