# Spec 12 – World Championship Unlock System  
(Unlocking Mixed / Multi-Game modes and Coming Soon control)

## 1. Purpose

This spec defines how advanced modes (Mixed Game, Multi-Game, Dealer’s Choice, etc.)
are locked until the player clears the Badugi World Championship, and how they are
unlocked and displayed in the UI.

Goals:
- Lock advanced modes behind a clear condition.
- Show "COMING SOON" for locked modes.
- Persist unlock state in localStorage.
- Trigger an unlock animation when the player clears the World Championship.
- Provide a simple API for other code (GameSelector, engines) to query unlock state.

---

## 2. Unlock State (playerProgress)

Global progress is stored in localStorage under the key "playerProgress".

Shape (conceptual):

- worldChampCleared: boolean  
  true if the Badugi World Championship has been cleared at least once.

- firstClearTimestamp: number or null  
  Unix timestamp (ms). Set when worldChampCleared becomes true for the first time.

- clearCount: number  
  Number of times the World Championship has been cleared. Starts from 0.

Initial value on a fresh install:

- worldChampCleared = false  
- firstClearTimestamp = null  
- clearCount = 0

If the stored JSON is missing or broken, the app must reinitialize it to the default.

---

## 3. Clear Condition

The World Championship (WC) is a specific Badugi tournament path with multiple stages:

- Local League
- Regional League
- National League
- World League (final)

The unlock condition is:

- The player wins the final match of the World League in the Badugi WC mode.

When this happens:

- worldChampCleared becomes true.
- clearCount is incremented by 1.
- firstClearTimestamp is set to the current timestamp if it was null.

This update is done by a dedicated function (name example):
- updateProgressAfterWorldChampClear()

---

## 4. Effects of Unlock

When worldChampCleared is true:

1) Mixed Game mode (see Spec 11) becomes available.
2) Any "Multi-Game tournament" or similar future advanced modes become available.
3) GameSelector no longer shows "COMING SOON" on those entries.
4) First time only:
   - Show a special unlock animation / popup.

These modes must remain locked as long as worldChampCleared is false.

---

## 5. GameSelector Behavior

GameSelector needs to read playerProgress on render and set lock flags.

For each advanced mode entry (Mixed Game, Multi-Game, Dealer’s Choice etc.):

- If worldChampCleared is false:
  - isLocked = true
  - show a COMING SOON label in the card.
  - button is disabled (no game start).
  - tapping or clicking can optionally show a tooltip:
    - "Clear the Badugi World Championship to unlock this mode."

- If worldChampCleared is true:
  - isLocked = false
  - no COMING SOON label.
  - button behaves as a normal selectable game mode.

Visual guidelines for locked entries:
- Grayed out or reduced opacity.
- No hover or press animation.
- Overlay text "COMING SOON" is clearly visible.

---

## 6. Unlock Animation and UX

The first time the player clears the World Championship,
immediately after the final win:

- The game must:
  - Call updateProgressAfterWorldChampClear().
  - Trigger a one-time unlock animation or popup.

Unlock popup contents example (text-level spec):

- Title: "World Championship Cleared!"
- Subtitle: "New game modes have been unlocked."
- List (bullets or icons):
  - Mixed Game
  - Multi-Game Tournament
  - Dealer’s Choice (if implemented)
- Single "OK" button to continue to lobby.

This popup should only auto-appear the first time worldChampCleared becomes true.
For later clears (clearCount > 1), a simpler notification is enough.

---

## 7. Integration Points

7.1 World Championship Engine

- At the end of each WC match, the engine already decides win/lose.
- When the player wins the final league:
  - Call updateProgressAfterWorldChampClear().
  - Call the unlock UX handler (e.g. showUnlockPopup()).

7.2 App startup

- On app boot:
  - Try to read playerProgress from localStorage.
  - If missing or invalid, reinitialize to default.
  - Keep it in a central store or context for easy access.

7.3 GameSelector

- When rendering the menu/grid:
  - Ask a helper (e.g. isAdvancedModeUnlocked()) which internally checks worldChampCleared.
  - Set isLocked and label for advanced entries accordingly.

---

## 8. Logging

When the player clears the WC for the first time, a log entry must be recorded.

Minimal fields:

- event: "WORLD_CHAMP_CLEAR"
- timestamp: number (Unix ms)
- clearCount: number (the new value after increment)

On later clears (clearCount > 1), the same event type can be reused,
or a secondary event type such as "WORLD_CHAMP_RECLEAR" can be added if needed.

This log ties into the general JSONL log system defined in earlier specs.

---

## 9. Acceptance Criteria

Spec 12 is considered fully implemented when:

1. playerProgress with worldChampCleared, firstClearTimestamp, clearCount
   is persisted in localStorage and correctly initialized on first launch.

2. Unlock logic is triggered only when:
   - The player wins the final World League match in Badugi WC mode.

3. Mixed Game and other advanced modes:
   - Are locked and show COMING SOON when worldChampCleared is false.
   - Become selectable and lose the COMING SOON label when worldChampCleared is true.

4. The unlock popup appears immediately after the first clear and does not
   reappear on subsequent clears.

5. A log event for the first clear (WORLD_CHAMP_CLEAR) is written.

6. Behavior remains correct after restarting the app:
   - A player who already cleared WC still has all advanced modes unlocked.
