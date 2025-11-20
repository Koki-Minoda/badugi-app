# UI Flow Guide (Spec 15 Snapshot)

This document summarises the refreshed navigation and layout rules implemented
for Spec 15.

## Screen Map

- `TitleScreen` &rarr; shows hero copy + START button that leads to `/menu`.
- `MainMenuScreen` &rarr; central hub with Ring / Tournament / Mixed entries,
  unlock badges, and quick links to History / Settings / Profile.
- `GameSelectorScreen` &rarr; reorganised into hero + advanced cards + variant
  grid, using shared design tokens.
- Table, History, Settings continue to inherit the responsive rules defined in
  Spec 15 (primary actions pinned to the bottom on small devices, cards scale
  responsively).

## Design Tokens

All shared colours, spacing, typography, and elevations are declared in
`src/styles/designTokens.js`. Components import the tokens instead of hard-coded
values. Tokens include:

- `colors.background`, `colors.surface`, `colors.accent`, etc.
- `spaces` (4/8/12/20/32/48 pixels) and `radius` (8/16/24/pill).
- `typography` sizes for headings, body, and small caps.
- `elevation.card`/`surface` box-shadows for consistent depth cues.

## Unlock + Status Messaging

- Main Menu exposes unlock progress with stage counters.
- Game Selector surfaces advanced cards (Mixed / Multi / Dealer's Choice) with
  COMING SOON hints when locked.
- Title screen mentions version + stored profile, aligning with Spec 12-15 flow.

## Responsive Guidelines

- Hero layouts use `max-w-6xl` containers and gradient backgrounds.
- Buttons leverage rounded pills on mobile, grid cards adapt from 1-column to 3
  columns via Tailwind's responsive utilities.
- All new sections honour the Spec 15 rule of keeping primary actions reachable
  within thumb range (e.g., START + Settings group).
