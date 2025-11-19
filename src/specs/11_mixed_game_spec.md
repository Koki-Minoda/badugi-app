# Spec 11 – Mixed Game System  
(1–20 selectable games / fixed order & dealer’s choice / switch by hands)

## 1. Purpose

This spec defines the Mixed Game system that allows the user to:

- Select 1–20 games from the full game list (Spec 10)
- Choose between:
  - FIXED order rotation (user-defined sequence)
  - RANDOM (Dealer’s Choice) rotation
- Switch the active game every N hands (e.g. 1, 4, 8, 12 hands)
- Use Mixed Game mode in:
  - Tournament
  - Ring (cash game)

Mixed Game must work with all game IDs defined in Spec 10.

---

## 2. Data Model

### 2.1 MixedGameProfile (user configuration)

Stored in localStorage as JSON.

Fields:

- `id: string`  
  - UUID or unique ID for the profile.
- `name: string`  
  - Profile name, e.g. "My 10-Game Mix".
- `selectedGameIds: string[]`  
  - Ordered list of game IDs (e.g. ["B01", "D03", "ST1"]).
  - Length must be between 1 and 20.
- `selectionMode: "FIXED" | "RANDOM"`  
  - FIXED: use the order of `selectedGameIds`.
  - RANDOM: ignore order and choose randomly each rotation.
- `handsPerGame: number`  
  - How many hands to play before switching game.
  - Positive integer (e.g. 1〜30).
- `allowDuplicates: boolean`  
  - If true, the user can include the same game ID multiple times.
- `createdAt: number` (timestamp)
- `updatedAt: number` (timestamp)

This object is purely configuration and does not change during a session
(after game start), unless user explicitly edits the profile.

---

### 2.2 MixedGameState (runtime)

Kept in memory while playing Mixed Game.

Fields:

- `activeProfileId: string | null`  
  - ID of the profile currently in use, or null if not in Mixed mode.
- `activeGameId: string | null`  
  - Game ID currently being played (e.g. "D03" for Badugi TD).
- `currentIndex: number`  
  - Index into `selectedGameIds` for FIXED mode.
- `handsPlayedInCurrentGame: number`  
  - Counter of how many hands have been completed with `activeGameId`.

This state is reset when:

- Changing to a different Mixed profile, or
- Leaving Mixed mode.

---

## 3. Rotation Behavior

### 3.1 When rotation happens

- Game rotation **never** occurs mid-hand.
- Rotation decision is made **immediately after a hand ends**, before the next hand starts.

Hook:

- After each hand ends (pot awarded, hand summary done), the controller calls:
  - `updateMixedGameStateAfterHandEnd()`
  - `selectNextActiveGame()`


### 3.2 FIXED mode (selectionMode = "FIXED")

Behavior:

1. At the start of the session:
   - `currentIndex = 0`
   - `activeGameId = selectedGameIds[0]`
   - `handsPlayedInCurrentGame = 0`
2. After each hand:
   - `handsPlayedInCurrentGame++`
   - If `handsPlayedInCurrentGame >= handsPerGame`:
     - Set `handsPlayedInCurrentGame = 0`
     - Increase `currentIndex` by 1
     - If `currentIndex >= selectedGameIds.length`:
       - Wrap around to 0 (loop)
     - Set `activeGameId = selectedGameIds[currentIndex]`


### 3.3 RANDOM mode (selectionMode = "RANDOM") – Dealer’s Choice

Behavior:

1. At session start:
   - Pick a random game ID from `selectedGameIds` and set it as `activeGameId`.
   - `handsPlayedInCurrentGame = 0` (for logging only; can be reused).
2. After each hand:
   - `handsPlayedInCurrentGame++`
   - If `handsPlayedInCurrentGame >= handsPerGame`:
     - `handsPlayedInCurrentGame = 0`
     - Pick a new random game ID from `selectedGameIds`
       - Currently simple uniform random is acceptable.
       - Do not guarantee that the new game differs from previous; duplicates allowed.


### 3.4 Constraints

- If `selectedGameIds` is empty, Mixed Game cannot start (show error).
- If `selectedGameIds.length === 1`, rotation still works but game never changes.
- `handsPerGame` is always respected (game is kept for exactly N completed hands).

---

## 4. UI Specification

### 4.1 Entry points

- On the top-level GameSelector, add an entry:
  - "Mixed Game" (locked until world championship clear; controlled by another spec).
- Choosing Mixed Game opens the **Mixed Game Setup** screen.

---

### 4.2 Mixed Game Setup Screen

Sections:

1. Game Selection
2. Rotation Mode
3. Hands per Game
4. Profile Save / Load

#### 4.2.1 Game Selection UI

- Show all available games from Spec 10 in a list.
- Each row:
  - Checkbox
  - Game name
  - Optional tags (e.g. "Triple Draw", "Stud", "Hi-Lo").
- Requirements:
  - User can select between 1 and 20 games.
  - Selection count is shown, e.g. "Selected: 7 / 20".
- Internal value:
  - Each checked game adds its game ID to `selectedGameIds`.

#### 4.2.2 Order control (for FIXED mode)

- Below the selection list, show a "Selected Games" list.
- Only checked games appear here, in the order they were chosen.
- User can reorder via:
  - Drag & Drop (preferred), or
  - Up / Down buttons.
- This ordered list corresponds directly to `selectedGameIds`.

#### 4.2.3 Rotation Mode

- Radio buttons or segmented control:

  - "Fixed order rotation"
  - "Dealer’s Choice (random)"

- When "Fixed order" is selected:
  - The "Selected Games" order is meaningful.
- When "Dealer’s Choice" is selected:
  - Order is still displayed but not used for rotation logic.

#### 4.2.4 Hands per Game

- Numeric input (stepper or text field with validation).
- Label:
  - "Switch game every [ N ] hands"
- Constraints:
  - N: integer, default 8
  - Minimum 1, maximum e.g. 30

#### 4.2.5 Profile Save / Load

- User can:
  - Save current settings as a profile.
  - Load an existing profile.
  - Rename or delete a profile.
- Under the hood:
  - All profiles are stored as a JSON array in localStorage key:
    - `mixedGameProfiles`
  - Each profile is a `MixedGameProfile`.

---

## 5. Game Start and Engine Integration

### 5.1 Starting Mixed Game

When the user confirms the setup:

1. The selected profile (existing or "temp") is stored.
2. `MixedGameState` is initialized:
   - `activeProfileId` = profile.id
   - `currentIndex = 0`
   - `handsPlayedInCurrentGame = 0`
   - `activeGameId`:
     - FIXED: first `selectedGameIds[0]`
     - RANDOM: random choice from `selectedGameIds`
3. The app creates a `GameEngine` instance via registry using `activeGameId`.
4. Table is created and first hand starts.

### 5.2 Switching Engine between Hands

At the end of a hand:

1. The controller checks if Mixed mode is active (`activeProfileId` != null).
2. It updates `MixedGameState` according to rules in section 3.
3. If `activeGameId` has changed:
   - Dispose current engine instance.
   - Create new engine instance using the new `activeGameId`.
   - Start next hand with the new engine.
4. Player stacks, tournament level, and seat order are **not reset**:
   - Only the engine and game rules change.

---

## 6. Tournament vs Ring Behavior

### 6.1 Tournament Mode

- Mixed Game rotation affects only:
  - Game rules (engine)
  - Evaluation logic
- Shared elements across all games in a Mixed tournament:
  - Blinds/antes level
  - Tournament structure (levels, payouts)
  - Player chips / bust-outs
- Level changes are independent of game type:
  - A new level can start while the game is NLH, PLO, Badugi, etc.

### 6.2 Ring (Cash) Mode

- Stakes (SB/BB) are fixed for the whole Mixed session.
- Player stacks carry across game types.
- No "levels" or scheduled blind increases.
- Mixed rotation only changes the current game rules.

---

## 7. Logging Requirements

Mixed Game must be visible in logs for later analysis and RL.

For each hand, at minimum:

- `handRecord.gameId` = `activeGameId` used in that hand.
- When a game switch occurs (i.e., `activeGameId` changes between hands), an event is logged:

Fields example:

- `event: "MIXED_GAME_SWITCH"`
- `fromGameId: string`
- `toGameId: string`
- `profileId: string`
- `handsPerGame: number`
- `selectionMode: "FIXED" | "RANDOM"`

These fields can be added to existing JSONL log schema (Spec 08).

---

## 8. Acceptance Criteria

Mixed Game feature is considered complete when all below are true:

1. User can select between 1〜20 games and save them as a profile.
2. Rotation mode can be set to:
   - FIXED (order defined by drag & drop)
   - RANDOM (Dealer’s Choice)
3. User can choose `handsPerGame` and the app switches games after exactly N hands.
4. Switching never happens mid-hand; only between hands.
5. Tournament and Ring modes both support Mixed Game.
6. Stacks and tournament progression continue across game changes.
7. MixedGameProfile is persisted in localStorage, and is reloadable.
8. Logs contain enough information to reconstruct the sequence of games in a Mixed session.

