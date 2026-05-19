# MGX Mobile Tournament Layout Policy

Status: active P0 gate for friend alpha mobile checks.

## Priority Order

Mobile landscape tournament layout must allocate vertical space in this order:

1. Hero action buttons
2. Actor / Hero identity
3. To call / current bet
4. Phase / draw / bet round
5. Blinds / players
6. Prize / payout / details

## Hard Rules

- Hero action buttons must be fully visible and clickable without scrolling.
- PWA / standalone mode does not relax this requirement.
- Tournament HUD must compact before Hero buttons clip.
- Phase / round context must compact before Hero buttons clip.
- Hero stats grid must shrink or reflow before Hero buttons clip.
- Basic actions must not rely on vertical or horizontal scroll.
- Buttons must remain usable touch targets.

## P0 Conditions

- Call, Raise, Fold, Check, or Draw button bounding box is clipped by the visual viewport.
- Button center is outside the visual viewport.
- Button center is covered by another element.
- Hero action area requires scrolling in landscape tournament.
- Hero is canonical actor but visible action controls cannot be tapped.

## Scope

This policy applies to Core5 tournament mobile landscape layouts. Desktop, cash,
engine rules, evaluator logic, tournament result logic, and CPU/RL routing are
out of scope.
