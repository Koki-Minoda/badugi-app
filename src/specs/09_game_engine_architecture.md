# Spec 09 – Game Engine Abstraction / Multi-Game Architecture

## Motivation

Up to Spec 08, the app focuses on Badugi-only logic with several
game-specific flows (betting, draw, showdown, history logging).
To support ~20 poker variants and Mixed Game rotations, the core
architecture must be refactored around a shared `GameEngine` abstraction.

Goals:

- Reuse as much infrastructure as possible (players, pots, betting loop).
- Allow each variant (Badugi, Hold’em, 2-7TD, Stud, etc.) to plug in
  its own **deal / street flow / evaluation** while sharing UI and tools.
- Keep the engine API simple enough so Codex can implement new games
  with minimal boilerplate.

This spec defines:

1. The `GameEngine` base interface.
2. Derived engine types by family (Draw / Board / Stud / Mixed).
3. Shared state models (Player, Pot, Table).
4. Integration points with UI, logging, and RL.
5. Migration guidelines from the current Badugi-only implementation.

---

## 1. Core Concepts & Terminology

- **Game** – A specific poker variant (e.g. `"badugi"`, `"holdem_nlh"`,
  `"deuce27_td"`, `"stud8"`).
- **Engine** – A class (or module) implementing the rules and flow for
  one game, conforming to the `GameEngine` interface.
- **TableState** – Runtime state for a single table (players, pots,
  deck, current street, etc.).
- **Hand** – A single hand from blind posting to pot distribution.
- **Street** – A phase within a hand (e.g. preflop/flop/turn/river,
  pre-draw / draw1 / draw2 / draw3, 3rd/4th/5th/6th/7th street, etc.).

The UI (React) should **not** know specific game rules; instead it
interacts with an engine instance through a generic set of callbacks.

---

## 2. Shared Data Models

These models are shared across all engines.

### 2.1 Player

```ts
type PlayerId = string;

type PlayerState = {
  id: PlayerId;
  name: string;
  seatIndex: number;

  stack: number;         // chips not committed this hand
  bet: number;           // chips committed in current betting round
  totalInvested: number; // total chips invested in this hand

  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;

  holeCards: Card[];     // meaning depends on game
  boardCards: Card[];    // mainly for stud up-cards (optional)
};

### 2.2 Pot & Side Pots
type Pot = {
  amount: number;
  eligiblePlayerIds: PlayerId[];
};

type PotState = {
  mainPot: Pot;
  sidePots: Pot[];       // side pots ordered by contribution threshold
};

### 2.3 Table / Hand State
type TableState = {
  handId: string;
  gameId: string;              // e.g. "badugi"
  engineId: string;            // usually same as gameId

  players: PlayerState[];
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;

  pots: PotState;
  deck: Card[];

  street: StreetId;            // engine-specific enum
  drawRoundIndex?: number;     // for draw games

  actingPlayerIndex: number;
  lastAggressorIndex?: number;

  isHandOver: boolean;
};
The exact contents may be extended per game, but these fields should
exist for all engines.

### 3. GameEngine Base Interface

The GameEngine interface describes the minimal contract that all games
must follow. Individual engines may expose additional helpers, but
UI / framework code should only depend on this API.

interface GameEngine {
  /** Identifier, e.g. "badugi", "holdem_nlh". */
  readonly id: string;

  /** Human-readable name for UI. */
  readonly displayName: string;

  /** Creates initial TableState for a new hand (after dealer chosen). */
  initHand(ctx: EngineContext): TableState;

  /** 
   * Handles forced actions at the beginning of the hand:
   * blinds, antes, bring-in, etc.
   */
  applyForcedBets(state: TableState): TableState;

  /**
   * Returns the next required player action, or null if none.
   * Used by UI & AI to know whose turn it is and what options exist.
   */
  getNextActionRequest(state: TableState): ActionRequest | null;

  /**
   * Applies a player action (fold/call/raise/check/draw, etc.)
   * and returns the updated state.
   */
  applyPlayerAction(
    state: TableState,
    action: PlayerAction
  ): TableState;

  /**
   * Progresses the game to the next street / draw round when
   * the betting round is complete (and no showdown yet).
   */
  advanceStreet(state: TableState): TableState;

  /**
   * Checks if the hand is over (everyone but one folded, or showdown done).
   */
  isHandOver(state: TableState): boolean;

  /**
   * Performs showdown: evaluates hands, splits pots, and returns
   * final state with `isHandOver = true` and pot distributions applied.
   */
  resolveShowdown(state: TableState): TableState;

  /**
   * Provides a summary for UI & logs: winners, final hands, etc.
   * Called after `resolveShowdown`.
   */
  getHandSummary(state: TableState): HandSummary;
}
Supporting types:
type EngineContext = {
  tableConfig: TableConfig;   // blinds, antes, max players, etc.
  rng: Rng;                   // random number generator
};

type ActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "DRAW";

type ActionRequest = {
  playerId: PlayerId;
  allowedActions: ActionType[];
  minBet?: number;
  maxBet?: number;            // for PL/NL, use current stack constraints
  drawOptions?: DrawOptions;  // for draw games
};

type PlayerAction = {
  type: ActionType;
  playerId: PlayerId;
  amount?: number;            // for BET/RAISE/CALL when needed
  drawSelection?: number[];   // indices of cards to discard
};
An engine may internally delegate to shared helpers for betting state
and pot settlement.

### 4. Engine Families & Specialization

Rather than making one massive base class, engines should be grouped
into families that share internal helpers.

### 4.1 Draw Engine (Badugi, 2-7TD, A-5TD, ARCHIE, etc.)

Additional state:

drawRoundIndex (0–2 for triple draw, 0 for single draw).

maxDrawRounds (game parameter).

Additional helpers:

performDraw(state, playerId, selectedCardIndices).

shouldContinueDrawing(state): boolean.

Draw flow:

initHand – deal 4 or 5 cards per player.

applyForcedBets – blinds / antes.

Betting round using shared betting helper.

Draw round:

Players choose discards.

Engine deals replacement cards.

Repeat steps 3–4 until maxDrawRounds reached.

resolveShowdown.

### 4.2 Board Engine (Hold’em, Omaha, Dramaha)

State:

boardCards: Card[].

Street sequence: PREFLOP → FLOP → TURN → RIVER (or game-specific).

Responsibilities:

Manage board dealing per street.

Enforce Omaha rules (2 from hand + 3 from board).

Support Hi-only / Hi-Lo split evaluation depending on game.

### 4.3 Stud Engine (Stud, Stud8, Razz, etc.)

State:

Each player has up-cards and down-cards.

Street sequence: 3rd, 4th, 5th, 6th, 7th.

Responsibilities:

Dealing up/down cards per street.

Determining bring-in / action order by visible hand strength.

Evaluations for Hi / Lo / split.

### 4.4 Mixed Engine (uses other engines)

Mixed game logic is defined in Spec 11.
Here we only define that each underlying game is represented by its own
engine; the Mixed mode will simply switch which engine is active per
hand while reusing GameEngine API.

### 5. Shared Betting & Pot Helpers

To prevent each engine from re-implementing betting logic, a shared
"betting state machine" should be provided in a core module, for
example src/games/core/betting.ts.

Responsibilities:

Track:

Current bettor index.

Current bet size and raises per round.

Raise cap (for FL).

Provide functions:

startBettingRound(state): BettingState

applyBetAction(bettingState, action): BettingState

isBettingRoundComplete(bettingState): boolean

Integrate with TableState to update player stacks and pot.

Engines will:

Use the helper to drive betting rounds.

Decide when to start and stop a betting round
(e.g. pre-draw, post-draw, post-flop).

### 6. Integration with UI

The UI should interact with an engine instance via narrow interfaces:

engine.getNextActionRequest(state)

UI uses this to:

Highlight the acting player.

Render available buttons (fold/call/raise/draw).

engine.applyPlayerAction(state, action)

Called when user clicks a button or CPU selects an action.

engine.advanceStreet(state)

Called when betting round is complete and another street is needed.

engine.resolveShowdown(state)

Called when the hand requires showdown.

The App component (or a controller hook) owns:

The current TableState.

The current GameEngine instance (from a registry by gameId).

The main loop (hand start → actions → streets → showdown → next hand).

### 7. Integration with Logging & RL

The engine must be compatible with Spec 08 (Action log / JSONL schema)
and future RL environment specs.

Every call to applyPlayerAction should be accompanied by a log entry
conforming to Spec 08.

Engine must expose enough information for RL observations:

Current player index.

Public cards (board / stud up-cards).

Betting state and pot size.

Player stacks and positions.

interface GameEngine {
  // ... core API ...

  /**
   * Returns a machine-readable snapshot for RL / debugging.
   * This is NOT used by core UI, but by RL tooling.
   */
  getObservation(state: TableState, playerId: PlayerId): Observation;
}

### 8. Engine Registry
A central registry maps gameId to engine factories:

type EngineFactory = () => GameEngine;

type EngineRegistry = {
  [gameId: string]: EngineFactory;
};

const engineRegistry: EngineRegistry = {
  badugi: createBadugiEngine,
  // future:
  // holdem_nlh: createHoldemNlhEngine,
  // deuce27_td: createDeuce27TdEngine,
};


Usage:

On game selection (GameSelector, Mixed mode), the app chooses a
gameId and instantiates the engine via the registry.

Mixed Game logic can swap gameId between hands.

### 9. Migration Plan (Badugi → Multi-Engine)
Step 1 – Core Models

Extract current Player, Pot, and betting helpers into
src/games/core/ and align them with the models in this spec.

Ensure Badugi uses these shared types.

Step 2 – BadugiEngine Implementation

Create BadugiEngine class implementing GameEngine.

Move code from:

drawRound.js

betRound.js

showdown.js

any Badugi-specific helpers
into BadugiEngine and new core modules.

Step 3 – UI Adapter

Refactor App.jsx (or equivalent) to use the GameEngine API instead
of calling Badugi functions directly.

Confirm that Badugi continues to work exactly as before.

Step 4 – Prepare for New Games

Once Badugi is running through GameEngine, new games can be added by:

Implementing new engine classes (HoldemEngine, Draw27Engine,
StudEngine, etc.).

Registering them in the engineRegistry.

Adding GameSelector entries and (later) Mixed Game profiles.

### 10. Acceptance Criteria

This spec is considered implemented when:

Badugi is fully playable using a BadugiEngine that implements
GameEngine.

App / UI do not call Badugi-specific logic directly; instead they
go through GameEngine API.

Basic tests prove that:

A hand can be played from blinds to showdown.

Fold / call / raise / all-in behave as expected.

Draw rounds work correctly via engine methods.

Engine registry exists and can be extended to register additional
games.

Logging (Spec 08) still works and uses engine-agnostic information.