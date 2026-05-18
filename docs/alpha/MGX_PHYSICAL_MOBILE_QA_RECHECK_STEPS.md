# MGX Physical Mobile QA Recheck Steps

Date: 2026-05-18

Preview URL: `https://mgx-poker.com/?mgxQa=mobile`

Expected deployed commit: `77506198e4f8c5441038b6770710d7746b2f6bfc`

## Purpose

Recheck the remaining physical mobile Badugi blockers after the Core5 progression fixes were deployed to preview.

## Badugi Tournament Recheck

1. Open `https://mgx-poker.com/?mgxQa=mobile`.
2. Confirm the QA/build panel shows commit `77506198e4f8c5441038b6770710d7746b2f6bfc`.
3. Start Badugi tournament.
4. In portrait, play at least 5 to 10 hands.
5. Rotate to landscape and play at least 5 hands.
6. Verify `Waiting for other players...` never remains fixed for more than 20 seconds.
7. Verify DRAW state never shows active BET controls.
8. Verify no-reraise betting closure does not return action to Hero.
9. Verify Hero receives another action only after an opponent re-raises.
10. If the game freezes, tap `Export Freeze Report` and save the JSON plus a screenshot.

## Core5 Spot Checks

- D01, D02, S01, S02 launch from the normal alpha flow.
- Action buttons are visible and tappable in portrait and landscape.
- Fold is not clipped.
- Pot and phase are visible.
- Result / next-hand path works.

## Required Result Labels

- `PASS`: no freeze, no mixed DRAW/BET controls, and Core5 spot checks pass.
- `PASS_WITH_NOTES`: playable with minor non-blocking visual notes.
- `HOLD`: any suspected progression freeze, stale controls, or missing result/next-hand path.
- `FAIL`: confirmed blocking progression or action-control defect.
