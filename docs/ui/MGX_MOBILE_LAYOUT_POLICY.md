# MGX Mobile Layout Policy

Date: 2026-05-20

## Scope

MGX mobile gameplay uses separate portrait and landscape policies. Portrait and landscape are not treated as one generic responsive layout. This policy applies to mobile cash and tournament gameplay, with tournament readability as the strictest target.

This policy is UI-only. It must not change gameplay logic, tournament engine behavior, CPU strategy, RL routing, evaluator behavior, or progression rules.

## Shared Priority

Mobile table battlefield must remain the dominant content region.

Always-visible priority:
1. Cards
2. Current actor
3. Action buttons
4. Pot
5. Betting state

Not always visible:
- Prize
- Next blind
- Players remaining
- Rail details
- Repeated folded labels
- Decorative metadata

## Portrait Policy

Portrait is a vertical game UI.

- Vertical flow is allowed.
- Hero controls are bottom anchored.
- HUD is compact.
- Rail is collapsed.
- Phase is inline.
- Tournament details are collapsible.
- Hero cards are prioritized over metadata.
- Table battlefield target is at least 70-75% of the visual viewport height.
- Action buttons are always visible when legal actions are available.
- Information density must be lower than desktop and must not use stacked metadata blocks.

Portrait prohibited patterns:
- Stacked metadata panels.
- Repeated labels.
- Oversized spacing.
- HUD or rail covering Hero cards.

## Landscape Policy

Landscape is a horizontal game UI.

- Split layout is allowed.
- Right-side compact HUD/control column is allowed.
- Table battlefield target is at least 70-75% of the visual viewport width.
- HUD and phase stay compact.
- Action buttons are immediately clickable without scroll.
- Rail remains minimal.
- Metadata is minimized.

Landscape prohibited patterns:
- Giant stacked panels.
- Scroll-required actions.
- HUD taller than the action area.
- Oversized Hero metadata.
- Vertical clipping.

## Layout Mode Contract

Mobile components must receive or derive explicit modes:

- `mobile-portrait`
- `mobile-landscape`

The app may still use CSS for styling, but mobile tournament layout decisions must be keyed off explicit portrait/landscape mode rather than treating width interpolation as a single responsive surface.

## Regression Gates

The structural gates are:

- `tests/e2e/mobile-layout-mode-regression.spec.ts`
- `tests/e2e/mobile-battlefield-ratio.spec.ts`

They must assert:
- explicit layout mode is applied.
- portrait battlefield ratio is maintained.
- landscape battlefield ratio is maintained.
- action buttons are visible when expected.
- Hero cards are fully visible.
- HUD does not overlap Hero cards.
- no clipping.
- no hidden legal buttons.
- no horizontal overflow.
- no vertical overflow requiring scroll for actions.
