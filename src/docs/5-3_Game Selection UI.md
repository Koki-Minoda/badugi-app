Step5-3: Universal Main Menu & Mode Selection System
====================================================

Goal
----
Create a complete multi-mode home screen ("Main Menu") that does NOT rely on 
Japanese game-specific labels (like 段位戦 or 大会戦) nor any visual reference images.

The system must be fully defined in text so that an engineer (or Codex) can implement it
without external assets.

This “Main Menu” must allow the user to choose between three high-level modes:

- MODE_A: Cash Game (standard ring games)
- MODE_B: Tournament (MTT)
- MODE_C: Friend Match (local/P2P)

Additionally:
- A Settings screen (gear icon)
- A Rules screen (? icon)
- Clear state transitions and UI wiring
- No existing gameplay logic is modified


1. Screen Layout (Language & Asset Independent)
-----------------------------------------------

Component: `MainMenuScreen`

Shown when: `mode === "menu"`

The screen contains four structural regions:

A. Background Panel
   - A full-screen container (div) that may show a color or placeholder image.
   - Does NOT depend on any artwork; Codex can use a neutral gradient or solid color.
   - Contains no logic.

B. Sidebar Visual Panel (optional)
   - Left side column, width ~30%.
   - Contains a placeholder illustration container (empty div or generic decoration).
   - Purely cosmetic. May remain blank.

C. Central Action Panel (primary UI)
   - A vertical stack of **three large mode buttons**.
   - These represent MODE_A, MODE_B, MODE_C.
   - Buttons must have:
     - A primary label (text provided by developer; defaults below)
     - A secondary descriptive subtitle
     - Data-testids:

       - `mainmenu-mode-a-button`
       - `mainmenu-mode-b-button`
       - `mainmenu-mode-c-button`

   Default display labels (these can be replaced by any future language pack):
   - MODE_A: "Cash Game"
     - Subtitle: "Standard Ring Mode"
   - MODE_B: "Tournament"
     - Subtitle: "Multi-Table Event"
   - MODE_C: "Friend Match"
     - Subtitle: "Local / P2P Play"

D. Top Navigation Bar
   - Spans the top of the screen.
   - Contains:
     - Player name
     - Currency/chips (optional)
     - Two icon buttons at right:

       • Settings button  
         data-testid="mainmenu-settings-button"

       • Rules/Help button  
         data-testid="mainmenu-rules-button"

Icons can be simple SVG placeholders; actual art is optional.

E. Navigation transitions
   - Clicking MODE_A → open “Mode A: Cash Game Variant Selection”
   - Clicking MODE_B → open “Mode B: Tournament Event Selection”
   - Clicking MODE_C → open “Mode C: Friend Match Rule Config”
   - Clicking settings → open SettingsScreen
   - Clicking rules → open RulesScreen


2. MODE A: Cash Game Variant Selection Screen
---------------------------------------------

Component: `CashGameSelectionScreen`
Shown when: `mode === "cash-select"`

Purpose: Choose which game variant to play in a ring (cash) format.

Layout:
- Title: "Cash Game"
- List of available variants, each displayed as a card or row.
- Each variant card includes:
  - Variant name (e.g., "Badugi", "PLO", "2-7 Single Draw")
  - Brief description
  - Clickable area

Data-testids:
- `cash-variant-badugi`
- `cash-variant-plo`
- `cash-variant-27sd`
(and general pattern: `cash-variant-${id}`)

On click:
- Set `currentVariant = <chosen>`
- Call:

  `startGame({ mode: "cash", variant: <chosen>, config: defaultCashConfig })`

- Transition: `mode = "game"`

A Back button returns to MainMenu.


3. MODE B: Tournament (MTT) Event Selection Screen
--------------------------------------------------

Component: `TournamentSelectionScreen`
Shown when: `mode === "tournament-select"`

Purpose: Choose which MTT event/structure to enter.

Layout:
- Title: "Tournament"
- List of tournament event cards:
  - Name: e.g., "Default Badugi MTT"
  - Metadata: tables, seats, stack, payout
  - Enter button

Data-testids:
- `tournament-event-default`
- `tournament-enter-button`

On click:
- Call existing `startTournamentMTT()`
- Transition: `mode = "game"`

Back button available.


4. MODE C: Friend Match (P2P) Rule Configuration Screen
-------------------------------------------------------

Component: `FriendMatchConfigScreen`
Shown when: `mode === "friend-config"`

Purpose: Configure local/P2P table rules before creating/entering a private match.

Config elements:
1) Variant selector  
   data-testid="friendconfig-variant-select"

2) Table type selector  
   (cash game / simple freezeout)  
   data-testid="friendconfig-tabletype-select"

3) Blind settings  
   (dropdown or presets)  
   data-testid="friendconfig-blinds-select"

4) Seat count  
   data-testid="friendconfig-seats-select"

5) Room code/password (optional)  
   data-testid="friendconfig-roomcode-input"

Buttons:
- Create Room  
  data-testid="friendconfig-create-room-button"  
- Calls:
   startGame({
   mode: "friend",
   variant: selectedVariant,
   config: collectedConfig
   })


- Join Room  
data-testid="friendconfig-join-room-button"  
Stub allowed for now.

Back returns to main menu.


5. Settings Screen
------------------

Component: `SettingsScreen`

Layout:
- Toggles: BGM, SE, Animation Speed, etc.
- Back button.

Data-testid:
- `settings-screen`


6. Rules Screen
---------------

Component: `RulesScreen`

Layout:
- Sections for all variants:
- Badugi rules summary
- PLO rules summary
- 2-7 rules summary (etc.)

Data-testid:
- `rules-screen`

Back button returns to main menu.


7. App State & Routing
----------------------

Add global UI states:
- mode:
   "menu"
   "cash-select"
   "tournament-select"
   "friend-config"
   "game"

   currentVariant:
   "badugi" | "plo" | "27sd" | ...


Mode transitions:
- menu → cash-select / tournament-select / friend-config
- *-select → game (via startGame or startTournamentMTT)
- settings/rules → return to menu
- game → menu (via leave/quit button)

The main game table UI stays unchanged and still uses the existing Badugi flows.


8. Tests
--------

React Testing Library cases:

1) MainMenuScreen
   - mode buttons navigate to correct sub-screens
   - settings/rules open correct screens

2) CashGameSelectionScreen
   - selecting Badugi triggers startGame with mode: "cash" and variant "badugi"

3) TournamentSelectionScreen
   - entering default event triggers startTournamentMTT()

4) FriendMatchConfigScreen
   - form parameters appear in config passed to startGame
   - create-room button triggers correct startGame()

Non-goals:
- No dependency on Japanese UI terms
- No visual assets required
- No networking for P2P yet
- No changes to Badugi or MTT gameplay logic
