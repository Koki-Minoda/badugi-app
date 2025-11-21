## Spec09 Engine Migration Plan

### 1. Engine API surface
- `BadugiEngine.applyPlayerAction(state, { seatIndex, type, metadata })` handles FOLD/CALL/CHECK/RAISE/DRAW and updates `state.players`, `metadata.currentBet`, `lastAggressor`, etc.
- `BadugiEngine.advanceAfterBet(state, { drawRound, maxDraws, dealerIndex })` settles the pot, advances to DRAW/SHOWDOWN, and returns `{ state, players, pots, street, drawRoundIndex, showdown, showdownSummary, metadata }`.
- `BadugiEngine.resolveShowdown(state)` returns winner summary/pot splits and refreshed player stacks.
- `BadugiEngine.initHand(ctx)` creates the next table state and `applyForcedBets` seeds small/big blinds automatically.

### 2. Mapping to `App.jsx`
- Introduce `useGameEngine` to obtain the current engine instance from `GameEngineProvider`.
- Each hero action (`playerFold`, `playerCall`, `playerRaise`, `playerCheck`, `playerDraw`) should compose an action descriptor and call `engine.applyPlayerAction`, then merge the returned snapshot back into React state via a helper (`syncEngineSnapshot`).
- Round transitions (`finishBetRoundFrom`, `goShowdownNow`) should invoke `engine.advanceAfterBet` or `engine.resolveShowdown`, respect the returned `metadata` for `currentBet/betHead/lastAggressor`, and only call legacy helpers when the engine declines to advance.
- Shared metadata updates, logging (`recordActionToLog`, `saveRLHandHistory`), and deck syncing occur in a central `mergeEnginePlayers(snapshot)` helper for consistency.

### 3. Mixed/Tournament considerations
- The `GameEngineProvider` `setEngineId` call should respond to Mixed/Tournament state changes so that the same App.jsx logic can reuse whichever engine matches `gameId`.
- Additional helper hooks (e.g., `useMixedEngineId`) ensure App.jsx stays agnostic to the specific mode while still benefiting from the engine data.

### Implementation status
- [x] Hero action helper (`syncEngineSnapshot`, `handleHeroAction`) added and wired through Fold/Call/Check/Raise/Draw.
- [x] Round transitions now go through `engine.advanceAfterBet` and the helper reuses `runShowdown` when the engine reports SHOWDOWN.
- [x] Document the plan (this file) plus add regression tests for the new helpers once App.jsx finishes migrating.
