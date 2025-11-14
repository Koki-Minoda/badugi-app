# Spec 06 - Player Status Board HUD

## Goal
Solve Bug-06 (CPU stack/bet values were hard to read) by adding a permanent HUD that lists every seat’s vital info on top of the table.

## Requirements
- Show for every player (Hero + CPU), one row per card:
  - Name (Hero highlighted in green)
  - Position label (BTN / SB / BB / UTG / MP / CO)
  - Stack value
  - `betThisRound`
  - Status badges: `YOU`, `ALL-IN`, `FOLDED`, `BUSTED`, `ACTING`
- Header block displays “Table Status E, current dealer name, and total pot.
- Implemented in `ui/components/PlayerStatusBoard.jsx`, width Tailwind `w-72`, vertical card list with scrolling.
- `App.jsx` passes `players`, `dealerIdx`, `turn`, `totalPot`, and `positionLabels` so the HUD automatically follows dealer rotation.

## Placement
- Anchored inside the main table container (`relative w-[95%] max-w-[1200px] ...`) at `absolute top-4 left-4`, raised `z-index` so it stays above cards.
- When height is limited, the `max-h` + `overflow-y-auto` combo keeps content readable.

## Future Enhancements
- Consider collapse/expand controls, alternative placement for narrow/mobile layouts, and linking HUD rows to the action log for quick highlighting.
