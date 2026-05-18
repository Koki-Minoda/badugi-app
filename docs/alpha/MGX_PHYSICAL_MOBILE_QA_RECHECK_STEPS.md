# MGX Physical Mobile QA Recheck Steps

Date: 2026-05-19

Preview URL: `https://mgx-poker.com/?mgxQa=mobile`

Expected deployed commit: confirm the QA/build panel matches the latest deployed commit before starting. Current local release-readiness baseline is `59520e1c3d63e8e3e12d2fe6279107812fb382c0`; any new source change requires a fresh deploy/build-info match before physical QA evidence is accepted.

## Purpose

Recheck the remaining physical mobile Badugi blockers after the Core5 progression fixes were deployed to preview.

## Badugi Tournament Recheck

1. Open `https://mgx-poker.com/?mgxQa=mobile`.
2. Confirm the QA/build panel shows the expected deployed commit and a visible QA `sessionId`.
3. Confirm `Export Freeze Report` and CPU session export are visible.
4. Start D01 cash.
5. Play 2-3 hands, then use `Cash Out`.
6. Return to Menu.
7. Start Badugi tournament.
8. In portrait, play at least 10 hands.
9. Rotate to landscape and play at least 5 hands.
10. Verify `Waiting for other players...` never remains fixed for more than 20 seconds.
11. Verify DRAW state never shows active BET controls.
12. Verify DRAW1 CPU actions resolve without action application failure.
13. Verify no-reraise betting closure does not return action to Hero.
14. Verify Hero receives another action only after an opponent re-raises.
15. If the game freezes, tap `Export Freeze Report` and save the JSON plus a screenshot.
16. Export CPU session JSON at the end of the run and record the `sessionId`.

## Core5 Spot Checks

- D01, D02, S01, S02 launch from the normal alpha flow.
- Action buttons are visible and tappable in portrait and landscape.
- Fold is not clipped.
- Pot and phase are visible.
- Result / next-hand path works.
- QA panel sessionId, freeze export, and CPU export work.
- CPU telemetry includes decisionSource, legalActions, fallbackReason, variantId, and mode.

## Required Result Labels

- `PASS`: no freeze, no mixed DRAW/BET controls, and Core5 spot checks pass.
- `PASS_WITH_NOTES`: playable with minor non-blocking visual notes.
- `HOLD`: any suspected progression freeze, stale controls, or missing result/next-hand path.
- `FAIL`: confirmed blocking progression or action-control defect.
