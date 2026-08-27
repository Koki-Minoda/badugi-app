# P2P Friend Match

MGX Friend Match currently exposes one quality-gated mode: authenticated,
heads-up Badugi. Other catalogue games are intentionally hidden until they
have the same server-authoritative rules and browser coverage.

## Play flow

1. A signed-in host creates a room at `/friend-match`.
2. The host shares the six-character room code.
3. A second signed-in user joins with the code.
4. Both players press Ready. The server deals four private cards, posts the
   blinds and controls turn order.
5. The hand runs through four betting rounds and three draws. Each player can
   replace zero to four selected cards. The server evaluates Badugi hands and
   distributes the pot.
6. Both players can press Ready again for a new hand. The dealer rotates. If a
   player was busted, the button explicitly starts a new match and resets both
   stacks to the configured starting stack.

REST endpoints live under `/api/p2p/rooms`. WebSocket remains the preferred
live transport at `/ws/p2p/{roomCode}`. The access token is sent as a WebSocket
subprotocol so it does not appear in proxy access-log URLs. If the browser
cannot establish a socket after three consecutive transient failures, it
automatically switches to authenticated HTTPS polling. State, Ready, betting
actions and draws all remain server-authoritative over this fallback path, so
Friend Match does not depend on a production nginx WebSocket change.

Every mutation carries a client-generated `commandId` plus the observed
`handId` and `expectedPhase`. The same command and ID are retained if a lost
WebSocket acknowledgement is retried over REST. The backend validates and
records the command in the same room lock as the game mutation: an exact retry
returns the original viewer state without changing cards or chips, while an
old hand/phase or conflicting reuse returns HTTP 409. Receipts expire after
ten minutes and are capped per room. All incoming states share one monotonic
sequence gate, so late socket or polling responses cannot rewind the UI.

## Authority and privacy

- The FastAPI `backend/app` process owns the deck, private hands, stacks, pot,
  legal actions, current actor and showdown result.
- The player identity comes from the signed access token. Client-supplied
  player IDs and display names are not trusted.
- Each socket or authenticated state response receives an individualized,
  non-cacheable state. A player sees only their own cards until a showdown
  reveal.
- Illegal, out-of-turn and duplicate draw actions are rejected by the server.
- The UI renders only the server's `legalActions` and submits card indexes for
  a draw; it does not run a second local game engine.

## Reconnect boundary

Refreshing or temporarily losing the network reconnects the socket and asks
for the latest authoritative state. A newer connection for the same user
replaces the older socket. Close codes 4001, 4004 and 4401 remain terminal and
do not fall back. Other repeated connection failures switch to HTTPS polling
at one-second intervals; successful REST actions apply their returned state
immediately.

Rooms are currently held in backend memory. They survive browser reconnects
but do **not** survive a backend restart or work across multiple backend
processes. Production scaling requires a shared room snapshot/event store and
cross-process broadcast before multiple workers are enabled.

## Current exclusions

- More than two players
- Spectators and public lobbies
- Invite links and matchmaking
- Durable recovery after backend restart
- Ratings or RL export from friend-match results
- Non-Badugi variants

These exclusions are product boundaries, not implied support.
