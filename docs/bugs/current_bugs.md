---
title: Current blocker list
---

# Current confirmed problems

1. **Playwright SB-fold spec needs stronger navigation guards.**  
   - The `START` button redirect flickers between `/menu` and `/game`, so we run a `Promise.race` between the two and wait for the `Leaderboard` button before proceeding. This keeps the test resilient to layout changes.
2. **Documented start screen confirmation.**  
   - `tests/start-screen.png` has been moved into the docs directory along with a brief caption covering the `START` / `Settings` labels and the Google Translate bubble for future reference.
3. **Runner helper docs should mention Playwright prerequisites.**  
   - The old `runner.py` no longer prints `sys.executable`. Instead, the README/docs explain that `playwright.sync_api` is required and how to launch the dev server (`npm run dev` or `Playwright webServer` mode).

## Badugi gameplay regressions (new findings)

1. **Bet-round counter still appears stuck after the draw cycle.**  
   - The console shows `phase: BET` while the on-screen `Phase` tag does not advance (it stays `BET#0` or `BET#1`). Added bet-round instrumentation and now display `Bet Round X/4` in the Table summary to prove the counter is advancing before/after each draw. Observe the new `Bet Round` row when you step through draws to confirm the progress. If it still lags, the log entries we added earlier will show which transition failed.
2. **Hand rollback / draw-count oscillation after repeated draw actions.**  
   - Screenshots show `drawRound` resetting to an earlier number when “Draw Selected” completes, and stale hands reappear. Logs around `[DRAW][NEXT_TO_DRAW]` suggest `setPlayers` is getting overwritten by outdated snapshots that clear `hasDrawn`. Added `[TRACE] about to call finishDrawRound`, `[TRACE] finishDrawRound start`, and `[STATE] finishDrawRound RESET snapshot` logging so we can see both the incoming snapshot and the version being applied for the next BET.
3. **Hand result overlay renders side pot sections even when a single pot exists.**  
   - The overlay now displays `Pot #2` even though only the main pot took place, and the pot total stays at ¥0. Only render extra pot blocks when `summary.potDetails` contains a positive `potAmount`, and make sure `summary.potAmount` matches the actual stored `pots`.

4. **SB/UTG flow still freezes when SB folds before the first draw.**  
   - Playwright logs show the SB action ends but the carousel never advances; UTG stays highlighted without action buttons, and the same SB seat reappears in the next round even though `seatOut`/`folded` flags were set. The fallback from `nextAliveFrom` / `findNextAliveAfter` still prefers the same seat, so we need to ensure that a folded CPU is excluded and the next alive seat (BB then UTG) gets the turn.
5. **Draw hand rollback persists even after cards change.**  
   - When the hero swaps cards in Draw#2 the next draw round shows the pre-change hand, and the soon-after Showdown logs show `null` references. The new `[E2E-ACTION]` traces capture hand/stack metadata and should reveal which `setPlayers` call reverts the hand after `finishDrawRound`.

Document any further issues in this list so we can prioritize fixes in Spec order.

## Automation coverage

* `e2e/sb-fold-bug.spec.js` already covers main menu→SB fold flow.
* `e2e/draw-rollback.spec.js` now validates sequential `finishDrawRound` logs and asserts a hero Badugi win after all CPUs bust, so we can catch the rollback/role bugs automatically in the future.
4. **Showdown pot eligibility excluded the real winner.**  
   - The showdown summary logs kept selecting CPU seats while the hero’s Badugi never appeared in the winners list, even though Hero was eligible for the main pot. Added a fallback in `resolveShowdownLegacy` to include the first active seat whenever the regular eligible set comes back empty so the hero can no longer be skipped, and recorded this behavior in the doc.
5. **SB fold did not hand turn to the BB/UTG when someone else still has action.**  
   - After SB folds the next alive seat should always be BB if alive, otherwise UTG, but the previous `nextAliveFrom` path sometimes fell through and forced the hand to end. Added `findNextAliveAfter` as a fallback so the action carousel continues even without a full re-loop, keeping the postfold flow alive.
