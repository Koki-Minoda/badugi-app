---
title: Current blocker list
---

# Current confirmed issues

1. **Playwright SB-fold spec is failing during navigation.**
   - After clicking START the SPA routes quickly jump between `/menu` and `/game`, so `page.waitForURL("**/game*")` alone timed out. We now race `/game` and `/menu` in the test and wait for the Leaderboard button to confirm arrival. This adds resilience against layout changes.

2. **Documented debug start screen artifacts.**
   - Moved `tests/start-screen.png` into `docs/e2e_start_screen.png` and noted what the START button, Settings link, and Google Translate bubble look like so Playwright selectors can be tuned.

3. **Polished post-release bug helper list.**
   - Removed the obsolete `sys.executable` log from `runner.py`, ensured README/docs mention `playwright.sync_api` usage, and documented how to fire the dev server (manual or `webServer` automation) for the next spec.

4. **Tournament all-check freeze.**
   - Before any engine snapshot arrived, the fallback table state lacked `gameId`, so `createTableState` errors prevented the round from finishing. `ui/App.jsx` now reads the active tournament session’s `gameId` and injects it into every engine snapshot and fallback metadata, so tournaments can resume even without a prior engine message.

5. **Folded seats lost their last-action badge.**
   - `BadugiEngine.advanceAfterBet()` cleared `lastAction`, leaving folded seats blank. `ensureLastActionLabelsForSnapshot` copies the previous label (defaulting to `Fold`) so the HUD keeps the fold marker visible.

6. **Call after a check showed blank.**
   - Metadata sometimes reported `toCall = 0` but `paid > 0`, which reset `lastAction` to `Check` and then cleared it. The call handler now looks at both fields, falling back to `Call` whenever money moved, so the HUD keeps the correct text.

## Recent findings

* **Draw indicator surfaced during bet rounds.**
  - `finishDrawRound` and `drawSelected` now update `phase` and `drawRound` together, and `TableSummaryPanel` reads the current phase before deciding whether to show “Draw Progress.” This keeps the badge consistent with the actual phase state.
* **Showdown logging crashed when computing payouts.**
  - `buildHandResultSummary` now constructs `payouts` before calculating `payoutSum`, so the overlay no longer hits a ReferenceError. `getWinnersByBadugi` also logs each winner’s evaluated cards/ranks so the UI output matches the evaluation.
* **Badugi comparison order was reversed.**
  - `compareEvaluations` now compares `metadata.size` first, then `rankPrimary`, and then the `metadata.ranks` array lexicographically, aligning with the rule that more cards beat fewer and smaller kickers lose.
