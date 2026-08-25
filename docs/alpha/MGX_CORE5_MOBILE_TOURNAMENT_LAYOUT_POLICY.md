# MGX Core 5 Mobile Tournament Layout Policy

## Scope

This policy applies to mobile tournament gameplay for the Core 5 alpha games:

| Game | Variant |
| --- | --- |
| Badugi | `badugi` |
| 2-7 Triple Draw | `D01` |
| A-5 Triple Draw | `D02` |
| 2-7 Single Draw | `S01` |
| A-5 Single Draw | `S02` |

Game logic, actor order, pot logic, rules, evaluators, routing, and availability are outside this policy.

## Mobile Tournament Principle

Mobile tournament screens must prioritize playable game state over tournament details.

Priority order:

1. table, seats, and cards
2. pot
3. acting state
4. action controls
5. phase, draw round, and betting round
6. tournament HUD details

## Portrait Policy

- Tournament HUD is compact by default.
- Full payout detail is not shown as a large initial block.
- Table remains the primary visual area.
- Hero controls stay fully inside the viewport.
- Action buttons may wrap or stack.
- Fold must never be clipped when visible.
- The table must not depend on fixed `100vh`; dynamic viewport units and safe-area padding are preferred.

## Landscape Policy

- Table and HUD may use a two-column layout.
- Table must keep minimum readable width and height.
- Seat and card scale should be reduced for mobile landscape density.
- HUD is compact and secondary.
- Pot remains inside the table.
- Hero cards must not clip under browser chrome.

## Safe Area

- Use `100dvh` / `svh` where appropriate.
- Avoid fixed 100vh assumptions on mobile.
- Add safe-area padding where controls approach screen edges.
- Prefer compact mode over hard orientation blocking for Core 5 games.

## Regression Evidence

The gate is covered by:

```bash
npx playwright test tests/e2e/core5-mobile-tournament-layout-regression.spec.ts --project=badugi-flow
npx playwright test tests/e2e/core5-mobile-tournament-portrait-layout.spec.ts --project=badugi-flow
npx playwright test tests/e2e/core5-mobile-tournament-landscape-layout.spec.ts --project=badugi-flow
```
