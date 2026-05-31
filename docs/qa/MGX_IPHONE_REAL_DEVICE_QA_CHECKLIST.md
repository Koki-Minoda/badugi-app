# MGX iPhone Real Device QA Checklist

Date: 2026-05-30

Scope: iPhone Safari, iOS home-screen PWA, Termius/Blink SSH, and
code-server operation for MGX real-device QA. This document is a checklist and
runbook only. It does not change source code, tests, package configuration, or
deployment state.

Primary companion:

- `docs/planning/MGX_IPHONE_AI_ORCHESTRATION_AUDIT.md`

## Summary

Use this checklist after Claude review and Codex implementation, before commit
approval, whenever a change can affect MGX runtime, tournament flow, HUD,
mobile layout, PWA behavior, or AI/Codex operation from iPhone.

The practical flow is:

1. Review the diff on iPhone through code-server or Termius.
2. Run focused local checks from Termius when needed.
3. Open MGX on iPhone Safari with `?mgxQa=mobile`.
4. Exercise the manual smoke path and the changed feature path.
5. Capture evidence before recovery, reload, or commit.
6. Decide commit go/no-go using the checklist at the end of this document.

The highest-risk MGX areas for iPhone QA are:

- Badugi action flow: BET, DRAW, showdown, next hand.
- Tournament MTT state: blind level, players remaining, rebalance, Hero bust.
- HUD display: level/blinds/antes, hand counter, remaining players.
- Actor gating: no "Waiting for OUT", no actor on folded/all-in/busted seats.
- Mobile/PWA layout: action buttons and cards must remain tappable inside the
  iPhone visual viewport.
- QA evidence: freeze report, CPU session report, screenshot/video, branch and
  commit identity.

## Preconditions

### iPhone Safari

Manual Safari QA should use:

- URL: `https://mgx-poker.com/?mgxQa=mobile` for live QA.
- URL: `https://mgx-poker.com/dev/?mgxQa=mobile` only when the dev proxy is
  intentionally active.
- Normal Safari tab mode first. Do not rely on PWA standalone mode to hide
  Safari chrome.
- Test both portrait and landscape for changes that can affect layout or touch
  controls.

Before testing:

- [ ] Confirm iPhone battery/network are stable enough for screen recording.
- [ ] Close stale MGX tabs if testing reload/recovery behavior.
- [ ] Disable private browsing if local storage, auth, or PWA state matters.
- [ ] Confirm the URL includes `?mgxQa=mobile` when QA panel evidence is needed.

Relevant files:

- `docs/alpha/MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`
- `src/ui/qa/MobileQaDebugPanel.jsx`
- `src/ui/qa/mobileFreezeDetector.js`
- `src/ui/qa/mobileQaRecovery.js`
- `src/ui/App.jsx`

Related automated checks:

- `tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts`
- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/mobile-app-smoke.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`

### PWA Home-Screen Launch

PWA QA should be treated as an additional pass after Safari tab mode.

- [ ] In Safari, open `https://mgx-poker.com/?mgxQa=mobile`.
- [ ] Use Share -> Add to Home Screen.
- [ ] Launch MGX from the home-screen icon.
- [ ] Confirm the app opens without Safari URL/tab chrome.
- [ ] Rotate portrait -> landscape -> portrait.
- [ ] Start Badugi tournament and reach a Hero action state.
- [ ] Confirm action buttons are fully visible and tappable.
- [ ] Sleep/wake the iPhone and confirm the game can recover or be reloaded.

Relevant files:

- `public/manifest.webmanifest`
- `index.html`
- `src/ui/App.jsx`
- `src/ui/components/MobileOrientationGate.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Related automated checks:

- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`
- `tests/e2e/responsive-layout-separation.spec.ts`

Uncovered by automation:

- True iOS standalone launch behavior.
- Real Safari sleep/wake behavior.
- Real Safari bottom bar size and address bar animation.

### Termius/Blink SSH

Use SSH for low-friction command execution.

Start every session:

```bash
cd /home/mgx/badugi-app
git status --short
git log --oneline -6
```

Working tree expectations:

- [ ] Identify unrelated dirty files before reviewing a Codex diff.
- [ ] Do not use `git add .`.
- [ ] Stage only explicitly approved paths.
- [ ] Do not run deploy or push commands unless the user explicitly approves.
- [ ] Do not paste passwords, API keys, or private tokens into prompts or docs.

Useful status commands:

```bash
git diff --stat
git diff --name-only
git diff --cached --name-only
```

### code-server

Use code-server for diff review and file reading.

- [ ] Open the changed file and its nearest test side by side.
- [ ] Search for the bug ID, test ID, or function name before editing.
- [ ] Keep `CLAUDE.md` and this checklist accessible.
- [ ] Confirm App runtime changes do not introduce broad formatting churn.
- [ ] Use terminal inside code-server only for focused commands.

High-risk review targets:

- `src/ui/App.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`
- `src/ui/utils/tournamentHudUtils.js`
- `src/ui/utils/e2eTestDriver.js`

### MGX Dev Preview URL

MGX has two important frontend URL modes:

- Production base: `/`
- Vite dev base: `/dev/`

Use:

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

Then test the routed dev preview only if nginx/dev proxy is intentionally
configured:

- `https://mgx-poker.com/dev/?mgxQa=mobile`

Relevant files:

- `vite.config.js`
- `playwright.config.js`
- `infra/nginx/mgx-poker.com.conf.example`
- `infra/nginx/mgx-poker.com-ssl.conf.example`
- `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md`

### Clean Working Tree Expectations

For commit decisions, clean means:

- The intended changed files are known.
- Unrelated dirty docs/reports are either absent or explicitly excluded.
- `git diff --cached --name-only` contains only approved paths.

Minimum pre-commit commands:

```bash
git status --short
git diff --stat
git diff --name-only
git diff --cached --name-only
```

## Daily iPhone QA Flow

Use this flow when validating a Codex implementation from iPhone.

1. Termius: check branch and dirty state.

```bash
cd /home/mgx/badugi-app
git status --short
git log --oneline -6
git diff --stat
```

2. code-server: review the actual diff.

- [ ] Confirm only target files changed.
- [ ] Confirm tests were added/updated for the modified behavior.
- [ ] Confirm no docs/reports from unrelated work are in the target set.

3. Termius: run focused tests if the change requires it.

Examples:

```bash
npx vitest run src/ui/utils/__tests__/tournamentHudUtils.test.js
npx vitest run src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx
npx vitest run src/games/badugi/engine/__tests__/tournamentMTT.test.js
npm run test:game:known-bugs
```

4. iPhone Safari: open MGX with QA mode.

- [ ] Open `https://mgx-poker.com/?mgxQa=mobile`.
- [ ] Confirm `MGX Mobile QA` panel is visible.
- [ ] Record the QA session ID if evidence will be attached.

5. Manual smoke path.

- [ ] Title -> Main Menu -> Game works.
- [ ] Cash start works.
- [ ] Tournament start works.
- [ ] CPU action progression continues without freeze.

6. Changed-area path.

- [ ] Exercise the exact modified feature.
- [ ] Capture screenshot/video.
- [ ] Export freeze report if actor flow, wait state, or terminal state is
  suspicious.
- [ ] Export CPU session if CPU decisions or progression look suspicious.

7. Commit decision.

- [ ] Re-run `git status --short`.
- [ ] Review `git diff --cached --name-only` before commit.
- [ ] Commit only if P0/P1 failures are absent or explicitly accepted.

## Smoke QA

### Title -> Main Menu -> Game

Manual steps:

- [ ] Open `https://mgx-poker.com/?mgxQa=mobile`.
- [ ] Confirm title screen appears.
- [ ] Tap the title enter button.
- [ ] Confirm main menu appears.
- [ ] Open Cash or Tournament from the menu.
- [ ] Confirm the game table appears and is not blank.

Expected:

- Main menu is reachable.
- No white screen.
- No console-visible fatal UI state.
- QA panel can be expanded when `mgxQa=mobile` is present.

Target screens/components:

- `src/ui/screens/TitleScreen.jsx`
- `src/ui/screens/MainMenuScreen.jsx`
- `src/ui/screens/GameScreen.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/qa/MobileQaDebugPanel.jsx`

Existing tests:

- `tests/e2e/authenticated-game-smoke.spec.ts`
- `tests/e2e/mobile-app-smoke.spec.ts`
- `tests/e2e/main-menu-history-smoke.spec.ts`
- `src/ui/__tests__/AppInitialization.test.jsx`

### Cash Start

Manual steps:

- [ ] Start Badugi cash.
- [ ] Confirm Hero cards are visible.
- [ ] Confirm pot/blind state appears plausible.
- [ ] Wait for CPU opening actions.
- [ ] Confirm legal Hero buttons appear when Hero is actor.

Expected:

- Hero can act.
- CPU does not freeze on opening action.
- No folded/all-in/busted seat receives actor badge.
- The decision panel stays inside the viewport.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/ActionBar.jsx`
- `src/ui/components/Controls.jsx`
- `src/ui/components/Player.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Existing tests:

- `tests/e2e/badugi-cash-opening-actor-freeze.spec.ts`
- `tests/e2e/core5-cash-opening-cpu-action-regression.spec.ts`
- `tests/e2e/badugi-flow.spec.ts`
- `tests/e2e/mobile-app-smoke.spec.ts`
- `src/ui/__tests__/badugiCashOpeningActorSnapshotRegression.test.jsx`

Useful hooks:

- `window.__BADUGI_E2E__.getStateSnapshot()`
- `window.__BADUGI_E2E__.getControllerDebug()`
- `window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__()`

### Tournament Start

Manual steps:

- [ ] Start Badugi tournament.
- [ ] Confirm Tournament HUD appears.
- [ ] Confirm player count and level/blinds are visible.
- [ ] Confirm Hero table and seat are visible.
- [ ] Wait for CPU progression to reach a Hero action or terminal state.

Expected:

- HUD shows level/blinds/antes.
- Players remaining is not reset to the original full count after CPU bust.
- Tournament remains playable after background CPU actions.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `src/ui/utils/tournamentHudUtils.js`
- `src/games/badugi/engine/tournamentMTT.js`

Existing tests:

- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts`
- `tests/e2e/tournament/tournament-hud-ui.spec.ts`
- `src/games/badugi/engine/__tests__/tournamentMTT.test.js`
- `src/ui/utils/__tests__/tournamentHudUtils.test.js`

Useful hooks:

- `window.__BADUGI_E2E__.startTournamentMTT()`
- `window.__BADUGI_E2E__.getTournamentHudState()`
- `window.__BADUGI_E2E__.simulateTournamentBackground(count)`

### CPU Action Progression

Manual steps:

- [ ] Start cash or tournament Badugi.
- [ ] Let CPU seats act for at least one full orbit or until Hero action.
- [ ] Confirm "Waiting for other players" does not persist while no actor can
  legally act.
- [ ] Expand `MGX Mobile QA`.
- [ ] Tap `Refresh CPU Summary`.
- [ ] Export CPU Session if behavior looks wrong.

Expected:

- CPU actions progress the hand.
- Actor source and UI badge agree.
- The game reaches Hero action, next hand, or terminal result.

Target files:

- `src/ui/App.jsx`
- `src/ui/qa/mobileQaSession.js`
- `src/ui/qa/mobileFreezeDetector.js`
- `src/ai/qa/summarizeCpuDecisionTrace.js`

Existing tests:

- `tests/e2e/core5-cpu-action-diversity.spec.ts`
- `tests/e2e/badugi-tournament-draw1-cpu-action-regression.spec.ts`
- `tests/e2e/d01-cash-opening-cpu-action-regression.spec.ts`
- `tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts`

Useful hooks:

- `window.__MGX_LAST_CPU_SESSION_REPORT__`
- `window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__()`
- `window.__BADUGI_E2E__.getCurrentHandHistory()`

## Badugi Runtime QA

### BET Operation

Manual steps:

- [ ] Start Badugi cash or tournament.
- [ ] Reach a Hero BET phase.
- [ ] Confirm visible legal actions match the state: fold/call/check/raise.
- [ ] Tap Call or Check.
- [ ] On another hand, tap Raise if available.
- [ ] Confirm chip, pot, and next actor progression.

Expected:

- No disabled or illegal button is the only visible path.
- Actor advances after Hero action.
- Pot and bets do not visually reset incorrectly.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/ActionBar.jsx`
- `src/ui/components/Controls.jsx`
- `src/ui/qa/mobileFreezeDetector.js`

Existing tests:

- `tests/e2e/badugi-flow.spec.ts`
- `tests/e2e/badugi-raise-call-round-closure.spec.ts`
- `tests/e2e/badugi-browser-raise-call-reopen-regression.spec.ts`
- `src/ui/__tests__/badugiRaiseCallClosureSnapshot.test.jsx`
- `src/games/badugi/engine/__tests__/finishBetRoundFrom.test.js`

Useful hooks:

- `window.__BADUGI_E2E__.forceControllerAction(seat, payload)`
- `window.__BADUGI_E2E__.getStateSnapshot()`
- `window.__BADUGI_E2E__.getLastControllerActionFailure()`

### DRAW Operation

Manual steps:

- [ ] Reach DRAW phase.
- [ ] Select 0 to 4 cards.
- [ ] Confirm selected cards visibly toggle.
- [ ] Tap Draw/Stand Pat.
- [ ] Confirm the hand advances to the next draw/bet round or showdown.

Expected:

- Card selection is stable on touch.
- Draw action cannot leave Hero stuck waiting.
- Folded/all-in players do not block draw progression.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/Player.jsx`
- `src/ui/components/Controls.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Existing tests:

- `tests/e2e/badugi-tournament-bet-to-draw-regression.spec.ts`
- `tests/e2e/badugi-folded-draw-freeze-regression.spec.ts`
- `tests/e2e/core5-draw-allin-eligibility-regression.spec.ts`
- `tests/e2e/core5-draw-allin-visibility-regression.spec.ts`
- `src/ui/__tests__/drawControls.test.jsx`
- `src/ui/__tests__/drawAllInVisibilitySnapshot.test.jsx`

Useful hooks:

- `window.__BADUGI_E2E__.setupBadugiBetToDrawFixtureForTest()`
- `window.__BADUGI_E2E__.forceBadugiBetToDrawTransitionForTest()`
- `window.__BADUGI_E2E__.forceHeroDraw()`

### Card Selection

Manual steps:

- [ ] Tap each Hero card once.
- [ ] Confirm selected style appears.
- [ ] Tap the same card again.
- [ ] Confirm selection is removed.
- [ ] Rotate the device and confirm selection state remains understandable.

Expected:

- Hit targets are large enough.
- Selection does not scroll the page unexpectedly.
- Selected cards do not overlap action buttons.

Target files:

- `src/ui/components/Player.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/components/MobileOrientationGate.jsx`

Existing tests:

- `tests/e2e/draw-mobile-portrait-table-layout.spec.ts`
- `tests/e2e/mobile-app-smoke.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`
- `tests/e2e/triple-draw-mobile-layout-visual.spec.ts`

### Showdown

Manual steps:

- [ ] Play or force a hand to showdown.
- [ ] Confirm result/summary appears.
- [ ] Confirm winner/pot summary is readable.
- [ ] Confirm no stale Hero action buttons remain over the result.

Expected:

- Showdown does not keep a non-null actor.
- Result overlay does not block required next-hand controls.
- Pot summary matches visible outcome closely enough for manual sanity.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/HandResultOverlay.jsx`
- `src/ui/components/ShowdownResultToast.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Existing tests:

- `tests/e2e/badugi-full-round-pot-regression.spec.ts`
- `tests/e2e/badugi-flow.spec.ts`
- `src/ui/__tests__/badugiTerminalSnapshotMergeSpec.test.jsx`
- `src/games/badugi/engine/__tests__/badugiPayoutIntegrity.test.js`

Useful hooks:

- `window.__BADUGI_E2E__.resolveHandNow()`
- `window.__BADUGI_E2E__.getLastPotSummary()`

### Next Hand

Manual steps:

- [ ] After a hand result, tap Next Hand.
- [ ] Confirm a new hand is dealt.
- [ ] Confirm dealer/button/blinds move plausibly.
- [ ] Confirm hand count changes.
- [ ] Confirm Hero can act again when it is Hero's turn.

Expected:

- No stale phase or stale actor from previous hand.
- Cards and bets are reset.
- Tournament HUD hand/level values remain consistent.

Target files:

- `src/ui/App.jsx`
- `src/ui/utils/tournamentHudUtils.js`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Existing tests:

- `tests/e2e/core5-cash-multi-hand-soak.spec.ts`
- `tests/e2e/mgx-game-progression.spec.js`
- `src/ui/__tests__/stalePhaseMergeRegression.test.jsx`
- `src/games/testing/regression/gameProgressKnownBugs.test.js`

Useful hooks:

- `window.__BADUGI_E2E__.dealNewHandNow()`
- `window.__BADUGI_E2E__.forceDealNewHandNow()`

## Tournament QA

### HUD

Manual steps:

- [ ] Start Badugi tournament.
- [ ] Record HUD level/blinds/antes.
- [ ] Play or simulate enough hands to advance blind level.
- [ ] Confirm HUD level/blinds match actual blind level.
- [ ] Confirm hand counter resets when level advances.

Expected:

- HUD `levelLabel`, `currentBlinds`, and `currentLevelNumber` follow the actual
  App blind source.
- Stale tournament state does not leave HUD stuck at `Level 1 5/10`.
- Player counts remain canonical after the blind display is corrected.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `src/ui/utils/tournamentHudUtils.js`

Existing tests:

- `src/ui/utils/__tests__/tournamentHudUtils.test.js`
- `tests/e2e/tournament/tournament-hud-ui.spec.ts`
- `tests/e2e/tournament/blind-level-progression.spec.ts`
- `tests/e2e/badugi-mtt-flow.spec.ts`

Useful hooks:

- `window.__BADUGI_E2E__.getTournamentHudState()`
- `window.__BADUGI_E2E__.completeHeroHands(count)`
- `window.__BADUGI_E2E__.simulateTournamentBackground(count)`

### Blinds/Antes

Manual steps:

- [ ] Confirm initial blinds are visible.
- [ ] Advance to the next level.
- [ ] Confirm new blinds/ante are visible.
- [ ] Confirm actual blind posting matches displayed blinds by observing SB/BB
  chip movement.

Expected:

- Displayed blinds and posted blinds agree.
- `blindLevelIndexRef.current` and HUD display do not diverge.

Target files:

- `src/ui/App.jsx`
- `src/ui/utils/tournamentHudUtils.js`
- `src/ui/qa/mobileFreezeDetector.js`

Existing tests:

- `tests/e2e/tournament/blind-level-progression.spec.ts`
- `src/ui/utils/__tests__/tournamentHudUtils.test.js`
- `src/games/badugi/engine/__tests__/tournamentMTT.test.js`

### Players Remaining

Manual steps:

- [ ] Start 18-player tournament if available.
- [ ] Let or force one CPU bust.
- [ ] Confirm HUD changes from `18 / 18` to `17 / 18`.
- [ ] Trigger or wait for rebalance.
- [ ] Confirm HUD does not revert to `18 / 18`.

Expected:

- `playersRemaining` uses canonical tournament state first.
- `totalEntrants` remains the original total.
- Rebalance does not reset visible counts.

Target files:

- `src/ui/utils/tournamentHudUtils.js`
- `src/ui/App.jsx`
- `src/games/badugi/engine/tournamentMTT.js`

Existing tests:

- `src/ui/utils/__tests__/tournamentHudUtils.test.js`
- `src/games/badugi/engine/__tests__/tournamentMTT.test.js`
- `tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts`

Useful hooks:

- `window.__BADUGI_E2E__.simulateTournamentBackground(count)`
- `window.__BADUGI_E2E__.getTournamentReplay()`
- `window.__BADUGI_E2E__.getTournamentHudState()`

### Hero Bust

Manual steps:

- [ ] Start tournament.
- [ ] Reach or force Hero bust.
- [ ] Confirm Hero is not shown as a waiting actor.
- [ ] Confirm there is no `Waiting for Ryo / OUT` style state.
- [ ] Confirm Hero bust overlay appears immediately.

Expected:

- `phase` is effectively `TABLE_FINISHED`.
- `turn` is null.
- Controller actor is null.
- Bust overlay and recap path are visible.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`

Existing tests:

- `src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx`
- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/core5-tournament-bust-lifecycle.spec.ts`
- `tests/e2e/core5-tournament-loss-feedback.spec.ts`

Useful hooks:

- `window.__BADUGI_E2E__.forceHeroBust()`
- `window.__BADUGI_E2E__.getStateSnapshot()`
- `window.__BADUGI_E2E__.isTournamentOverlayVisible()`

### TABLE_FINISHED

Manual steps:

- [ ] After Hero bust or tournament completion, inspect visible state.
- [ ] Confirm no action buttons are offered to Hero.
- [ ] Confirm Next Hand is not offered for a busted Hero flow unless explicitly
  expected by the result screen.
- [ ] Confirm Return to Menu or summary path works.

Expected:

- Terminal table flow does not revive an actor after async summary update.
- Overlay remains the primary user path.

Target files:

- `src/ui/App.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`

Existing tests:

- `src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx`
- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/core5-tournament-champion-lifecycle.spec.ts`

Useful hook:

- `window.__BADUGI_E2E__.getStateSnapshot()`

### Result Overlay

Manual steps:

- [ ] Run or fast-forward tournament completion.
- [ ] Confirm final placements are visible.
- [ ] Confirm top payout rows are readable.
- [ ] Confirm Back to Menu works.
- [ ] Confirm replay/coaching path is available if expected for the mode.

Expected:

- Final placement order is sorted.
- Payout rows are readable on iPhone.
- Overlay is not hidden behind HUD or QA panel.

Target files:

- `src/ui/components/TournamentResultOverlay.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/CoachingRecapPanel.jsx`
- `src/ui/App.jsx`

Existing tests:

- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/tournament-review-overlay.spec.ts`
- `tests/e2e/core5-tournament-loss-feedback.spec.ts`
- `tests/e2e/coaching-tournament-replay.spec.js`

Useful hooks:

- `window.__BADUGI_E2E__.fastForwardMTTComplete()`
- `window.__BADUGI_E2E__.getTournamentPlacements()`
- `window.__BADUGI_E2E__.getTournamentReplay()`

## Mobile/PWA QA

### Portrait

Manual steps:

- [ ] Open iPhone Safari in portrait.
- [ ] Start Badugi cash.
- [ ] Start Badugi tournament.
- [ ] Confirm table, Hero cards, HUD, and decision panel fit without horizontal
  scroll.
- [ ] Confirm buttons are tappable.

Expected:

- Portrait is usable.
- No forced landscape blocker appears for current MGX mobile layout.
- Decision panel remains inside visual viewport.

Target files:

- `src/ui/components/MobileOrientationGate.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/App.jsx`

Existing tests:

- `tests/e2e/mobile-app-smoke.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`
- `tests/e2e/core5-mobile-portrait-layout-visual.spec.ts`

### Landscape

Manual steps:

- [ ] Rotate iPhone to landscape in Safari tab mode.
- [ ] Confirm Safari URL/bottom bars do not clip action buttons.
- [ ] Reach Hero action state.
- [ ] Tap Call/Raise/Fold or Draw with trial-level confidence.

Expected:

- Critical controls fit inside `window.visualViewport`.
- HUD and side panels collapse before action buttons clip.

Target files:

- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/components/MobileOrientationGate.jsx`
- `src/ui/App.jsx`

Existing tests:

- `tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts`
- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts`
- `tests/e2e/core5-mobile-landscape-layout-visual.spec.ts`

### Safe Area

Manual steps:

- [ ] Inspect top notch/dynamic-island area.
- [ ] Inspect bottom home indicator area.
- [ ] Confirm action buttons, cards, and overlays do not sit under unsafe
  areas.
- [ ] Confirm QA panel does not hide required controls.

Expected:

- No critical control is clipped by top/bottom safe areas.
- Overlay close/menu buttons remain tappable.

Target files:

- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/qa/MobileQaDebugPanel.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`

Existing tests:

- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/ui-readability-smoke.spec.ts`
- `tests/e2e/tournament-busted-seat-readability.spec.ts`

### Safari Bottom Bar

Manual steps:

- [ ] In Safari tab mode, scroll/tap enough for browser chrome to change size.
- [ ] Rotate to landscape.
- [ ] Confirm action buttons are still visible.
- [ ] If controls clip, capture screenshot and export freeze report if the game
  also stopped progressing.

Expected:

- Visual viewport CSS vars track Safari browser chrome changes.
- Buttons remain in-bounds.

Target files:

- `src/ui/App.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `docs/alpha/MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`

Existing tests:

- `tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts`
- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`

Uncovered:

- Real Safari bottom bar animation on physical device.

### Home-Screen PWA Launch

Manual steps:

- [ ] Install MGX to home screen.
- [ ] Launch from the icon.
- [ ] Confirm full-screen/standalone appearance.
- [ ] Confirm title -> menu -> game path.
- [ ] Confirm portrait and landscape remain playable.

Expected:

- PWA launch improves available space but is not required for playability.
- PWA local storage/session behavior is acceptable.

Target files:

- `public/manifest.webmanifest`
- `index.html`
- `src/ui/App.jsx`

Existing tests:

- No true iOS PWA automation in repo.
- Use `tests/e2e/mobile-app-smoke.spec.ts` and real-device evidence.

### Sleep/Resume

Manual steps:

- [ ] Start a hand and reach Hero action.
- [ ] Lock iPhone for at least 30 seconds.
- [ ] Unlock and return to MGX.
- [ ] Confirm game remains playable or can recover through refresh.
- [ ] Export report if state is stuck.

Expected:

- No unrecoverable blank screen.
- No impossible waiting state.
- Reload returns to a sane route/menu/game state.

Target files:

- `src/ui/App.jsx`
- `src/ui/qa/mobileQaRecovery.js`
- `src/ui/qa/mobileFreezeDetector.js`

Existing tests:

- No physical sleep/resume automation.
- Closest checks:
  - `tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts`
  - `tests/e2e/mobile-app-smoke.spec.ts`

### Reload/Recover

Manual steps:

- [ ] Tap browser reload during menu.
- [ ] Tap browser reload during a Hero action state.
- [ ] Tap `Recover / Refresh Snapshot` in the QA panel if stuck.
- [ ] Confirm the app reaches a usable state or exports clear evidence.

Expected:

- Recovery does not create illegal actor state.
- Freeze report captures enough context before manual recovery.

Target files:

- `src/ui/qa/mobileQaRecovery.js`
- `src/ui/qa/mobileFreezeDetector.js`
- `src/ui/qa/collectBrowserGameplaySnapshot.js`
- `src/ui/App.jsx`

Existing tests:

- `tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts`
- `tests/e2e/cross-variant-fold-recovery.spec.ts`

Useful globals:

- `window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__()`
- `window.__MGX_RECOVER_MOBILE_QA__()`
- `window.__MGX_LAST_FREEZE_REPORT__`
- `window.__MGX_LAST_RECOVERY_REPORT__`

## AI Orchestration QA

### Claude Review Result -> Codex Instruction

Checklist:

- [ ] Claude output identifies exact files/functions.
- [ ] Claude output separates root cause from speculation.
- [ ] Claude output includes minimal allowed files.
- [ ] Claude output includes focused tests.
- [ ] Codex prompt forbids unrelated production areas.
- [ ] Codex prompt says whether to commit.

Good Codex prompt structure:

```text
Implement the minimal MGX fix.

Bug:
[observed issue]

Root cause:
[Claude summary]

Allowed files:
- [file]
- [test file]

Required:
- [behavior]
- [test]

Forbidden:
- no unrelated refactor
- no production logic outside listed files
- no git add .
- do not commit unless asked

Run:
- [focused command]
```

### Codex Diff Review on iPhone

Checklist:

- [ ] `git diff --stat` is small and matches the request.
- [ ] `git diff --name-only` has no unrelated docs/reports.
- [ ] code-server can open every changed file.
- [ ] The nearest test proves the bug cannot silently return.
- [ ] App.jsx changes are narrow and do not disturb actor/tournament flow.

Commands:

```bash
git diff --stat
git diff --name-only
git diff -- src/path/file.jsx
```

### Termius Test/Git Operation

Checklist:

- [ ] Focused tests run before broad tests.
- [ ] Long-running commands are avoided from iPhone unless necessary.
- [ ] Failed test output is captured in the final RV note.
- [ ] `git status --short` is checked before any commit.
- [ ] `git diff --cached --name-only` is checked after staging.

Focused command examples:

```bash
npx vitest run src/ui/utils/__tests__/tournamentHudUtils.test.js
npx vitest run src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx
npx playwright test tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow
npm run test:game:known-bugs
```

### code-server File Reading

Checklist:

- [ ] Read the production file and related test.
- [ ] Read nearest utility/helper before changing duplicated logic.
- [ ] Read E2E hook when a Playwright spec uses `window.__BADUGI_E2E__`.
- [ ] Keep unrelated dirty files unopened unless they affect the task.

Useful search terms:

- `forceHeroBust`
- `getTournamentHudState`
- `setupMobileTournamentHeroActionFixtureForTest`
- `TABLE_FINISHED`
- `handsPlayedThisLevel`
- `playersRemaining`
- `Waiting for`
- `mgxQa`

## Evidence Template

Use this template for manual iPhone QA notes.

```markdown
## MGX iPhone QA Evidence

Device:
- Model:
- iOS version:

Browser/PWA:
- Safari tab / PWA standalone:
- URL:

Orientation:
- Portrait / landscape:
- Visual issue with Safari chrome: yes/no

Branch/commit:
- Branch:
- HEAD:
- Dirty files:

Scenario:
- Mode:
- Variant:
- Tournament/cash:
- QA session ID:

Steps:
1.
2.
3.

Expected:
-

Actual:
-

Screenshot/video:
-

QA export:
- Freeze report:
- CPU session report:

Test command:
-

Result:
- PASS / FAIL / BLOCKED

Commit decision:
- GO / NO-GO
- Reason:
```

Minimum evidence for P0/P1 fixes:

- [ ] iPhone screenshot or video.
- [ ] Branch and commit hash.
- [ ] Exact URL and orientation.
- [ ] Manual steps and result.
- [ ] Test command output summary or reason not run.
- [ ] Freeze/CPU report when actor/progression is involved.

## Mapping to Existing Tests/Hooks

### Related E2E Hooks

Installed by:

- `src/ui/utils/e2eTestDriver.js`
- implemented through `src/ui/App.jsx`

Common hooks:

- `getStateSnapshot`
- `getControllerDebug`
- `getCrossVariantStateAudit`
- `getTournamentHudState`
- `getTournamentPlacements`
- `isTournamentOverlayVisible`
- `startTournamentMTT`
- `simulateTournamentBackground`
- `completeHeroHands`
- `forceHeroBust`
- `fastForwardMTTComplete`
- `getTournamentReplay`
- `setupMobileTournamentHeroActionFixtureForTest`
- `setupTournamentBustedSeatDisplayFixtureForTest`
- `setupBadugiWaitingFreezeFixtureForTest`
- `setupBadugiBetToDrawFixtureForTest`
- `setupBadugiTournamentCpuDrawFixtureForTest`
- `setupBadugiFoldedDrawFreezeFixtureForTest`
- `forceBadugiBetToDrawTransitionForTest`
- `forceFinishRoundForTest`
- `resolveHandNow`
- `dealNewHandNow`
- `forceDealNewHandNow`
- `forceControllerAction`
- `getCurrentHandHistory`
- `getHandHistory`

Mobile QA globals:

- `window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__`
- `window.__MGX_RECOVER_MOBILE_QA__`
- `window.__MGX_LAST_FREEZE_REPORT__`
- `window.__MGX_LAST_RECOVERY_REPORT__`
- `window.__MGX_LAST_CPU_SESSION_REPORT__`

### Related Playwright Tests

Smoke and navigation:

- `tests/e2e/authenticated-game-smoke.spec.ts`
- `tests/e2e/mobile-app-smoke.spec.ts`
- `tests/e2e/main-menu-history-smoke.spec.ts`

Badugi runtime:

- `tests/e2e/badugi-flow.spec.ts`
- `tests/e2e/badugi-cash-opening-actor-freeze.spec.ts`
- `tests/e2e/badugi-tournament-bet-to-draw-regression.spec.ts`
- `tests/e2e/badugi-tournament-draw1-cpu-action-regression.spec.ts`
- `tests/e2e/badugi-folded-draw-freeze-regression.spec.ts`
- `tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts`

Tournament:

- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts`
- `tests/e2e/core5-tournament-bust-lifecycle.spec.ts`
- `tests/e2e/core5-tournament-loss-feedback.spec.ts`
- `tests/e2e/tournament/tournament-hud-ui.spec.ts`
- `tests/e2e/tournament/blind-level-progression.spec.ts`
- `tests/e2e/tournament-busted-seat-readability.spec.ts`
- `tests/e2e/tournament-review-overlay.spec.ts`

Mobile/PWA-like layout:

- `tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts`
- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`
- `tests/e2e/mobile-tournament-readability.spec.ts`
- `tests/e2e/mobile-battlefield-ratio.spec.ts`
- `tests/e2e/draw-mobile-portrait-table-layout.spec.ts`

Useful commands:

```bash
npx playwright test tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts --project=badugi-flow
npx playwright test tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-mtt-flow.spec.ts --project=badugi-flow
```

### Related Vitest Tests

HUD/tournament:

- `src/ui/utils/__tests__/tournamentHudUtils.test.js`
- `src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx`
- `src/ui/__tests__/tournamentBustedSeatDisplayRegression.test.jsx`
- `src/games/badugi/engine/__tests__/tournamentMTT.test.js`

Badugi runtime:

- `src/ui/__tests__/badugiWaitingFreezeSnapshotRegression.test.jsx`
- `src/ui/__tests__/badugiTournamentBetToDrawSnapshotRegression.test.jsx`
- `src/ui/__tests__/badugiTournamentCpuDrawSnapshotRegression.test.jsx`
- `src/ui/__tests__/badugiFoldedDrawWaitingRegression.test.jsx`
- `src/ui/__tests__/badugiTerminalSnapshotMergeSpec.test.jsx`
- `src/games/badugi/engine/__tests__/badugiEngine.test.js`
- `src/games/badugi/engine/__tests__/roundFlowDrawSkip.test.js`

Draw family:

- `src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js`
- `src/games/draw/__tests__/drawAllInEligibilityRegression.test.js`
- `src/games/draw/__tests__/drawAllInVisibilityRegression.test.js`
- `src/games/testing/regression/gameProgressKnownBugs.test.js`

Useful commands:

```bash
npx vitest run src/ui/utils/__tests__/tournamentHudUtils.test.js
npx vitest run src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx
npx vitest run src/games/badugi/engine/__tests__/tournamentMTT.test.js
npm run test:game:known-bugs
```

### Uncovered Areas

Manual iPhone QA is still required for:

- True iOS Safari browser chrome behavior.
- True iOS PWA standalone launch and storage behavior.
- Sleep/wake and app switch resume behavior.
- Network interruption during a hand.
- Physical touch comfort for small controls.
- Screen recording evidence quality.
- code-server and Termius usability from the actual operator phone.

## P0/P1/P2 Failure Criteria

### P0: Do Not Commit

Classify as P0 if any of these occur:

- White screen or app cannot enter menu.
- Badugi hand freezes with no legal actor and no recovery path.
- Hero is asked to act after being busted/OUT.
- `Waiting for ... OUT` is visible after Hero bust.
- Tournament HUD shows stale blinds after actual blinds advanced.
- Players remaining resets incorrectly after CPU bust/rebalance.
- Action buttons are clipped or untappable on iPhone Safari.
- DRAW selection/action cannot be completed.
- Result/Hero bust overlay cannot be reached after terminal state.
- Commit staging includes unrelated files or secrets.

Required response:

- [ ] Stop commit.
- [ ] Capture screenshot/video.
- [ ] Export freeze report if runtime/progression related.
- [ ] Record branch, commit, URL, and steps.
- [ ] Send evidence back to Claude/Codex.

### P1: Commit Only With Explicit Acceptance

Classify as P1 if:

- Layout has minor overlap but all required controls remain tappable.
- HUD text is readable but cramped.
- QA panel blocks content unless collapsed.
- CPU session export works but summary is incomplete.
- PWA standalone differs from Safari but Safari tab mode is correct.
- Focused tests pass, but one related non-critical visual test is flaky.

Required response:

- [ ] Document the issue in commit/RV notes.
- [ ] Attach evidence.
- [ ] Decide whether to create a follow-up issue/task before commit.

### P2: Follow-Up Allowed

Classify as P2 if:

- Cosmetic spacing issue outside active controls.
- Non-critical copy/readability issue.
- Missing optional automation for a manually passing path.
- Minor docs mismatch not affecting QA execution.

Required response:

- [ ] Record follow-up.
- [ ] Do not block commit if P0/P1 are clear.

## Commit Go/No-Go Checklist

Commit GO requires:

- [ ] `git status --short` reviewed.
- [ ] `git diff --stat` reviewed.
- [ ] `git diff --name-only` contains only intended files.
- [ ] If staging was done, `git diff --cached --name-only` contains only
  approved files.
- [ ] No unrelated docs/reports are staged.
- [ ] No secrets, passwords, tokens, or private URLs are in the diff.
- [ ] Focused tests were run or a clear reason for not running them is written.
- [ ] iPhone Safari smoke passed if the change affects UI/runtime/mobile.
- [ ] PWA pass completed or explicitly marked not applicable.
- [ ] Evidence template is filled for runtime/mobile/tournament changes.
- [ ] P0 failures are absent.
- [ ] P1 failures are either absent or explicitly accepted.

Commit NO-GO if:

- [ ] There is any P0 failure.
- [ ] Target files do not match the requested scope.
- [ ] Tests fail without explanation.
- [ ] Dirty unrelated files are staged.
- [ ] A source-of-truth rule is violated:
  - tournament engine state for tournament lifecycle,
  - controller actor for action flow,
  - actual blind source for HUD blind display,
  - QA evidence before manual recovery.

Safe staging pattern:

```bash
git add path/to/approved-file-1 path/to/approved-file-2
git diff --cached --name-only
git commit -m "scope: concise message"
```

Never use:

```bash
git add .
```

## Next Recommended Automation Tasks

### P0

1. Add a Playwright spec that simulates the manual iPhone QA happy path:
   title -> menu -> Badugi tournament -> Hero action -> HUD snapshot -> Hero
   bust -> overlay -> no waiting-for-OUT state.

Suggested files:

- `tests/e2e/iphone-real-device-qa-smoke.spec.ts`
- helpers from `tests/e2e/helpers/gameProgressHelper.js`

Guarded areas:

- `src/ui/App.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/qa/MobileQaDebugPanel.jsx`

2. Add a small manual evidence script/check command that prints:

- branch
- HEAD
- dirty files
- build info
- recommended iPhone QA URL
- focused test suggestions

Suggested file:

- `scripts/qa/iphoneQaStatus.mjs`

### P1

1. Add PWA manifest regression check:

- manifest exists,
- display is standalone,
- icons resolve,
- iOS metadata remains present.

2. Add visual viewport regression covering:

- Safari-like portrait,
- Safari-like landscape with reduced height,
- QA panel expanded/collapsed,
- Hero bust overlay visible.

3. Add a report collector doc under `docs/qa` for where to store:

- screenshots,
- videos,
- freeze reports,
- CPU session reports.

### P2

1. Add code-server/Termius operator cheat sheet with:

- pane layout,
- copy/paste-safe commands,
- how to avoid accidental `git add .`,
- how to attach evidence to a review note.

2. Add a mobile QA index page linking:

- this checklist,
- `docs/planning/MGX_IPHONE_AI_ORCHESTRATION_AUDIT.md`,
- `docs/alpha/MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`,
- active blocker QA matrix.

