# MGX Mobile Tournament Readability Policy

Date: 2026-05-20

## Scope

This policy applies to mobile portrait and mobile landscape tournament play. It is a UI readability policy only. It must not change gameplay logic, tournament engine behavior, RL routing, CPU strategy, evaluator behavior, or progression rules.

## Root Principle

Mobile tournament playability is decided by whether the player can read the table at a glance during an active hand. Tournament metadata is secondary while a hand is in progress.

## Priority Order

Tier 1 (always visible)
- Hero cards
- Action buttons
- Current actor
- Pot
- Active player states

Tier 2 (compact/secondary)
- Blinds
- Hero position
- Draw/Bet round

Tier 3 (collapsible/hidden by default)
- Prize
- Next level
- Remaining players
- Rail
- Decorative labels

## Mobile Tournament Layout Rules

- The table battlefield must be reserved before tournament metadata.
- The table battlefield target is at least 55-60% of the visual viewport height in portrait.
- In landscape, the table must remain the dominant area and action buttons must remain fully visible inside the visual viewport.
- Hero cards must be fully visible and must not be covered by HUD, rail, phase, or action metadata panels.
- Pot and current actor must stay readable, but copy must be compact.
- HUD, phase, rail, and hand counters must be one-line or collapsed by default on mobile tournament views.

## HUD Policy

- Mobile tournament HUD default state is compact.
- Always visible HUD content is limited to current level/blinds and compact remaining-player count.
- Hands counter is minimized.
- Prize pool, next level, break, average stack, and top payouts are collapsible details.
- Large stacked HUD boxes are prohibited in mobile tournament play.

## Phase Policy

- Mobile tournament phase is an inline strip, not a vertical panel.
- Preferred copy is compact: `BET | D1 | R1` or `BET - Draw 1 - Round 1`.
- Repeated labels such as `PHASE`, `DRAW`, and `BET ROUND` must not consume separate vertical blocks.

## Rail Policy

- Mobile eliminated rail defaults to a collapsed chip/tag.
- The chip can expand on tap to show eliminated players.
- The rail must not permanently reserve a panel-sized row during active play.

## Seat Policy

- Mobile tournament seats show only information needed to recognize the seat, cards, stack/bet, and current action state.
- Folded and mucked are combined into a short state.
- Busted/out seats are represented as compact OUT state or moved to the rail; they must not remain as large inactive table panels.
- Current actor gets the strongest emphasis.
- Inactive seat metadata, repeated action labels, and decorative HUD stats are suppressed.

## Regression Gate

The structural audit is `tests/e2e/mobile-tournament-readability.spec.ts`.

It must check:
- Hero cards fully visible.
- Table center visible.
- No vertical clipping.
- HUD does not overlap Hero cards.
- Action buttons visible and inside the visual viewport.
- HUD compact height within threshold.
- Table battlefield ratio is maintained.
- Portrait and landscape coverage for Badugi and D01 tournament fixtures.
