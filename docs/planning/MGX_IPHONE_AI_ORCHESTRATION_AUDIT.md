# MGX iPhone AI Orchestration Audit

Date: 2026-05-30

Scope: repository/source audit only. No product code, test code, dependency install,
deploy, or commit was performed for this audit.

## Summary

MGX already has most of the technical hooks needed for iPhone-led AI
orchestration:

- A compact command surface in `package.json` for focused Vitest, Playwright,
  game-progress, soak, RL safety, AI evaluation, build, and preview checks.
- A mature E2E driver exposed as `window.__BADUGI_E2E__` through
  `src/ui/utils/e2eTestDriver.js`, with helpers for tournament start,
  state snapshots, HUD snapshots, Hero bust, mobile fixtures, and recovery.
- Mobile QA globals and UI in `src/ui/qa/*`, including freeze report export,
  CPU session export, and a visible `MGX Mobile QA` debug panel when
  `mgxQa=mobile` is used.
- Existing iPhone/Safari/PWA layout guidance in
  `docs/alpha/MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`.
- Existing Claude/Codex safety guidance in `CLAUDE.md`, including App.jsx,
  actor flow, tournament MTT, AI evaluation, and do-not-touch rules.
- Production/deploy guidance under `scripts/deploy`, `docs/deploy`, and
  `infra/nginx`.

Main gaps for iPhone operation are documentation and workflow packaging, not
low-level infrastructure:

- No single iPhone/Termius/code-server runbook existed before this document.
- No short "daily cockpit" checklist existed for Claude review, Codex
  implementation, human RV, physical QA, and commit decisions.
- Mobile/PWA regression tests exist, but there is no curated "run these first
  from a phone" list.
- Preview/dev server operations are documented in pieces but not tied to
  iPhone Safari validation.
- Commit hygiene is strong in practice, but needs an explicit "stage only
  target paths" rule for phone-driven work where dirty docs/reports often exist.

## Current Repo Findings

### package.json scripts

Important daily scripts:

- `npm run dev`: Vite dev server.
- `npm run build`: production build.
- `npm run preview`: Vite preview server.
- `npm test` / `npm run test:unit`: Vitest unit suite, excluding heavy AI
  evaluation suites.
- `npm run test:game:known-bugs`: primary known regression gate.
- `npm run test:game:one-hand`: broad one-hand progression gate.
- `npm run test:mgx:safety`: known bugs + one-hand + EV + RL safety.
- `npm run test:rl:safety`: RL schema, pipeline, ONNX adapter smoke.
- `npm run test:ai:pro`, `npm run test:ai:iron`: focused AI tests.
- `npm run test:e2e:progress`, `npm run test:e2e:progression`: focused
  Playwright progress gates.
- `npm run test:soak:fast`: fast browser telemetry soak.
- `npm run test:soak:mobile`: mobile portrait soak.

Heavy or governance-oriented scripts:

- `npm run test:ai-evaluation`
- `npm run test:all:serial`
- `npm run test:soak:exhaustive`
- AI training/export/evaluation scripts under `ai:*`, `train:ai:*`, and
  `eval:ai:*`

Phone guidance: do not run heavy AI evaluation or exhaustive soak casually from
iPhone/Termius. Prefer targeted commands first and ask Codex to run heavier
commands only when a change touches AI, RL, or shared runtime.

### docs/planning

Useful planning sources:

- `docs/planning/MGX_ACTIVE_BLOCKERS_QA_MATRIX.md`
  - Defines required mode/viewport matrix.
  - Lists focused commands for actor legality, mobile policy, tournament
    integration, and live/deploy smoke.
  - Defines physical QA evidence packets.
- `docs/planning/MGX_ACTIVE_BLOCKERS_EXECUTION_PLAN.md`
  - Separates physical QA blockers, mobile/tournament blockers, deploy/sync
    blockers, replay readability, and CPU quality.
  - States stop conditions for actor/order, terminal/result, mobile controls,
    stale turn, BET/DRAW mixed state, and historical guard failures.
- `docs/planning/MGX_ACTIVE_BLOCKERS_PROGRESS.md`
  - Progress tracker for blocker execution.
- `docs/planning/MGX_ACTIVE_TECH_DEBT_AUDIT.md`
  - Good source for non-P0 cleanup context.

### docs/ai

Useful AI/review sources:

- `docs/ai/MGX_REVIEW_MODE_SEPARATION.md`
  - Separates Cash Review and Tournament Review.
  - Tournament review must not reuse cash 30-hand gate language.
- `docs/ai/MGX_TOURNAMENT_REVIEW_IMPLEMENTATION_PLAN.md`
  - Tournament review implementation context.
- `docs/ai/MGX_TOURNAMENT_AI_FEEDBACK_AUDIT.md`
  - Tournament AI feedback status and risk context.
- `docs/ai/MGX_AI_FEEDBACK_STATUS_AUDIT.md`
  - Feedback pipeline status.
- `docs/ai/MGX_IRON_DO_NOT_TOUCH_BUCKETS.md`
  - AI governance buckets that should not be modified casually.
- `docs/ai/MGX_PREVIEW_DEPLOY_READINESS.md`
  - Preview deploy governance and staging guidance.

Current dirty files at audit start were unrelated AI/report artifacts:

- `docs/ai/MGX_PRO_STEP4Y_FRESH_VS_HISTORICAL_CORPUS.md`
- `docs/ai/MGX_STEP4Y_PRO_VS_IRON_NEXT_ACTION.md`
- `reports/ai-eval/pro-vs-standard-20260506.json`

Phone guidance: always run `git status --short` before accepting a commit plan.
Never use `git add .` in this repo during phone-driven operation.

### src/ui/App.jsx

`src/ui/App.jsx` is the main runtime orchestrator. It owns:

- Mode selection and tournament mode.
- Controller/session snapshot merge.
- Actor/turn resolution.
- Human/CPU action dispatch.
- Tournament MTT state application.
- HUD construction.
- Hero bust and tournament result overlays.
- E2E driver API implementation.
- Mobile QA integration.

High-value current hooks in App:

- `startTournamentMTT`
- `forceHeroBustNow`
- `fastForwardMTTComplete`
- `getTournamentHudSnapshot`
- `applyTournamentStateUpdate`
- `hydrateHeroTableFromTournamentState`
- `setupMobileTournamentHeroActionFixtureForTest`
- `setupTournamentBustedSeatDisplayFixtureForTest`
- `getStateSnapshot`

Recent risk-sensitive flows:

- HUD blind display must follow actual App blind source:
  `blindLevelIndexRef.current + activeBlindStructure`.
- Tournament engine canonical state still owns:
  `state.levelIndex`, `table.handsPlayedAtThisLevel`,
  `state.playersRemaining`.
- Hero bust terminal UI must keep:
  `phase=TABLE_FINISHED`, `turn=null`, controller actor null, and visible bust
  overlay.

### src/ui/screens

Important screens for iPhone QA:

- `TitleScreen.jsx`
  - Entry from title gate.
- `MainMenuScreen.jsx`
  - Cash/tournament/friend/history entry points.
- `GameSelectorScreen.jsx`
  - Variant launch and preview variant availability.
- `GameScreen.jsx`
  - Main game route wrapper.
- `TournamentScreen.jsx`
  - Tournament screen path.
- `ReplayScreen.jsx`
  - Replay review surface.
- `HistoryScreen.jsx` and `HandHistoryScreen.jsx`
  - Cash review and hand history.
- `MixedGameScreen.jsx`, `MultiGameScreen.jsx`, `DealersChoiceScreen.jsx`
  - Cross-variant and mode transition risk.

### src/ui/components

Important components for iPhone QA:

- `TournamentHUD.jsx`
  - Level/blinds, player count, table/seat, hands-in-level display.
- `HeroBustOverlay.jsx`
  - Hero eliminated overlay.
- `TournamentResultOverlay.jsx`
  - Tournament completion and review summary.
- `MobileOrientationGate.jsx`
  - Mobile orientation handling.
- `Controls.jsx`, `ActionBar.jsx`
  - Hero action controls.
- `Player.jsx`, `OpponentCard.jsx`
  - Actor badge, seat state, busted/OUT visibility.
- `TournamentEliminatedRail.jsx`
  - Busted-seat readability.
- `HandResultOverlay.jsx`, `ShowdownResultToast.jsx`
  - Terminal/result transitions.
- `ReplayCoachingOverlay.jsx`, `CoachingRecapPanel.jsx`,
  `CoachingSummaryPanel.jsx`
  - Review/coaching display surfaces.

### E2E hooks

`src/ui/utils/e2eTestDriver.js` installs `window.__BADUGI_E2E__`.

Useful hooks:

- `getStateSnapshot`
- `getTournamentHudState`
- `getTournamentPlacements`
- `isTournamentOverlayVisible`
- `startTournamentMTT`
- `simulateTournamentBackground`
- `completeHeroHands`
- `forceHeroBust`
- `fastForwardMTTComplete`
- `setupMobileTournamentHeroActionFixtureForTest`
- `setupTournamentBustedSeatDisplayFixtureForTest`
- `setupBadugiWaitingFreezeFixtureForTest`
- `setupBadugiBetToDrawFixtureForTest`
- `forceFinishRoundForTest`
- `forceBadugiBetToDrawTransitionForTest`
- `getHandHistory`
- `getCurrentHandHistory`

Mobile QA globals:

- `window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__`
- `window.__MGX_RECOVER_MOBILE_QA__`
- `window.__MGX_LAST_FREEZE_REPORT__`
- `window.__MGX_LAST_RECOVERY_REPORT__`

Manual QA URL flag:

- `?mgxQa=mobile`

### Playwright and Vitest configuration

`playwright.config.js`:

- Timeout: 30 seconds.
- Workers: 1.
- Web server command:
  `npm run dev -- --host 127.0.0.1 --port 3000`
- Reuses existing server on port 3000.
- Projects:
  - `legacy-e2e`
  - `badugi-flow`
  - `badugi-regression`

`vitest.config.js`:

- Environment: `jsdom`.
- Reporter: `dot`.
- Excludes `e2e/**`, `tests/e2e/**`, and `tests/badugi-regression/**`.

`vite.config.js`:

- Dev base path: `/dev/`.
- Production base path: `/`.
- Dev server proxies `/api` and `/ws` to backend port 8000.
- Allowed hosts include `mgx-poker.com`, `www.mgx-poker.com`, and server IP.
- HMR is configured for iPhone HTTPS `/dev/` via `wss` on port 443.

### nginx/dev preview/deploy

Deployment and preview-related files:

- `scripts/deploy/mgx-prod-01.sh`
  - Fetches target branch.
  - Installs frontend deps.
  - Builds frontend.
  - Installs backend deps.
  - Rsyncs `dist/` to `/var/www/mgx-poker`.
  - Restarts backend.
  - Runs `nginx -t` and reloads nginx.
  - Verifies live frontend assets, manifest, and `/api/health`.
- `scripts/deploy/check_mgx_health.sh`
  - Probes `/healthz` or `/api/health`.
  - Verifies frontend HTML.
- `infra/nginx/mgx-poker.com.conf.example`
- `infra/nginx/mgx-poker.com-ssl.conf.example`
- `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md`
- `docs/deploy/MGX_ALPHA_LIVE_DEPLOY_VERIFICATION.md`
- `docs/alpha/MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`

Important iPhone dev fact: Vite dev is served under `/dev/`, while production is
served under `/`.

### backend/app

Backend is FastAPI + SQLAlchemy:

- `backend/app/main.py`
  - Registers routers under `/api`.
  - Adds CORS.
  - Bootstraps local schema.
  - Checks Alembic migration state outside local/test.
- `backend/app/api/*`
  - Auth, health, users, variants, history, badugi actions/logs/stats/RL,
    tournament state, and analysis routes.
- `backend/app/core/*`
  - Settings, DB, security, OpenAI client.
- `backend/app/models/*`, `schemas/*`, `crud/*`
  - Persistence layer.

Backend run commands from `backend/README.md`:

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest
```

OpenAI keys belong only in backend env files. Do not put real keys or real
passwords in frontend files, docs, screenshots, or prompts.

## iPhone Operation Flow

### Termius shell flow

Use Termius for quick command execution:

1. `cd /home/mgx/badugi-app`
2. `git status --short`
3. `git log --oneline -6`
4. Check current diff:
   `git diff --stat`
5. For a target change, inspect exact files:
   `git diff -- src/path/file.js`
6. Run focused tests only.
7. Commit only explicit paths.
8. Push/deploy only after separate human approval.

### code-server flow

Use code-server for RV and small edits:

1. Open target files and tests in split view.
2. Keep `CLAUDE.md` and this audit doc visible.
3. Use search for the bug ID or test ID first.
4. Avoid broad formatting or import churn.
5. Before commit, compare:
   - `git diff --stat`
   - `git diff --name-only`
   - `git diff --cached --name-only`

### iPhone Safari/PWA QA flow

Use live or dev URL depending on purpose:

- Live: `https://mgx-poker.com/?mgxQa=mobile`
- Dev via nginx/Vite: `https://mgx-poker.com/dev/?mgxQa=mobile` if the dev
  proxy is active and routed.
- Local Playwright dev: `http://127.0.0.1:3000/` from the server only.

Manual steps:

1. Open MGX on iPhone Safari.
2. Add `?mgxQa=mobile`.
3. Start from title screen.
4. Enter Tournament and Badugi path.
5. Expand `MGX Mobile QA` debug panel.
6. Record session ID.
7. Test portrait and landscape.
8. If stuck, export freeze report before recover/refresh.
9. If CPU behavior is suspect, export CPU session.
10. Capture screenshot/video plus build info.

## Daily Commands

### Repository state

```bash
git status --short
git log --oneline -6
git diff --stat
git diff --name-only
git diff --cached --name-only
```

### Focused Vitest

```bash
npx vitest run src/ui/utils/__tests__/tournamentHudUtils.test.js
npx vitest run src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx
npx vitest run src/games/badugi/engine/__tests__/tournamentMTT.test.js
npm run test:game:known-bugs
npm run test:rl:safety
```

### Focused Playwright

```bash
npx playwright test tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts --project=badugi-flow
npx playwright test tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow
npx playwright test tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-physical-mobile-waiting-freeze-regression.spec.ts --project=badugi-flow
npx playwright test tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-mtt-flow.spec.ts --project=badugi-flow
```

### Scripted gates

```bash
npm run test:game:known-bugs
npm run test:game:one-hand
npm run test:mgx:safety
npm run test:e2e:progress
npm run test:e2e:progression
npm run test:soak:mobile
```

### Dev server

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

For iPhone dev through the public host, remember:

- Vite dev base is `/dev/`.
- HMR is configured for `wss://mgx-poker.com/dev/`.
- Backend dev server should run on port 8000 if API calls are needed.

### Backend

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest
```

### Build and preview

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

### Live/deploy verification only

Do not deploy from iPhone without explicit release approval. For read-only
health checks:

```bash
curl -fsS https://mgx-poker.com/api/health
curl -I https://mgx-poker.com/
./scripts/deploy/check_mgx_health.sh https://mgx-poker.com
```

## Claude <-> Codex Handoff Flow

### Claude investigation prompt

Use this when asking Claude for root-cause review:

```text
MGX investigation only. Do not edit files.

Bug:
[short bug title]

Observed:
[device/browser/mode/variant/phase/HUD/action details]

Evidence:
- command output:
- screenshot/video:
- freeze JSON/sessionId:
- relevant commit:

Please inspect:
- src/ui/App.jsx
- src/ui/utils/e2eTestDriver.js
- relevant component/test files
- relevant game/controller files

Return:
1. likely root cause
2. exact files/functions involved
3. minimal test-first fix plan
4. risks and do-not-touch areas
5. focused test commands

Constraints:
- no production rewrite
- no unrelated refactor
- preserve Badugi runtime, tournament MTT, actor gating, DRAW logic, HUD, and mobile layout
```

### Codex implementation prompt

Use this when asking Codex to implement:

```text
Implement the minimal fix for MGX.

Bug:
[bug title]

Root cause from review:
[summary]

Allowed files:
- [file 1]
- [file 2]

Required tests:
- [test file/spec]

Forbidden:
- no production rewrite
- no Badugi betting/draw/showdown/roundFlow changes unless explicitly listed
- no RL/evaluator/CPU strategy changes
- no unrelated docs/reports
- no git add .
- do not commit unless asked

Run:
[focused commands]

Report:
1. changed files
2. fix summary
3. tests run and result
4. known residual risk
5. production code touched or not
```

### Codex completion review prompt

Use this before commit:

```text
Review the current uncommitted MGX fix before commit.

Check:
1. Does it preserve the canonical source of truth?
2. Does it avoid side effects outside the target mode/variant?
3. Does it keep actor/turn/phase terminal behavior consistent?
4. Does it preserve playersRemaining/totalEntrants/HUD state?
5. Does fast-forward/background simulation avoid reviving stale actors?
6. Are tests sufficient and focused?
7. Are unrelated dirty files excluded?

If clean, commit only these paths:
[explicit paths]

Commit message:
[message]

After commit:
git status --short
```

### Human RV checklist before accepting AI output

1. Read `git diff --stat`.
2. Read `git diff --name-only`.
3. Confirm no unrelated docs/reports are staged.
4. Check hotspot file size and scope.
5. Confirm a failing or targeted regression exists.
6. Confirm focused tests passed.
7. Confirm no heavy AI outputs were regenerated accidentally.
8. Confirm no secrets, passwords, API keys, or live credentials were added.
9. Commit only explicit paths.

## Human Review Checklist

### Before asking Codex to edit

- Is this a product bug, QA gap, docs gap, or deploy gap?
- Can it be reproduced with an existing E2E hook?
- Can it be covered in Vitest instead of Playwright?
- Which canonical state owns the truth?
- Which files are forbidden for this task?
- Which command is the smallest meaningful validation?

### Before commit

```bash
git status --short
git diff --stat
git diff --name-only
git diff --cached --name-only
```

Review questions:

- Are only intended files changed?
- Are dirty `docs/ai` or `reports/ai-eval` files unrelated?
- Did App.jsx changes stay surgical?
- Did actor resolution use canonical helpers/snapshots?
- Did terminal state clear actor fields?
- Did HUD counts remain canonical?
- Did mobile controls remain tappable?
- Did tests prove the exact regression?

### Commit command pattern

```bash
git add path/to/file1 path/to/file2 path/to/test
git commit -m "type(scope): short message"
git status --short
```

Never use:

```bash
git add .
git reset --hard
git checkout -- .
```

## iPhone Real Device QA Checklist

### Evidence to collect

- Device model.
- iOS version.
- Browser: Safari, Chrome, PWA standalone.
- Orientation: portrait/landscape.
- URL and query flags.
- Build commit from `window.__MGX_BUILD_INFO__`.
- Variant and mode.
- QA session ID from `MGX Mobile QA`.
- Screenshot or video.
- Freeze report JSON if stuck.
- CPU session export if AI behavior is relevant.
- Pass/fail conclusion.

### Core path: Badugi tournament

Files likely involved:

- `src/ui/App.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`
- `src/ui/screens/layouts/MobileGameLayout.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/qa/mobileFreezeDetector.js`
- `src/ui/qa/MobileQaDebugPanel.jsx`
- `src/games/badugi/engine/tournamentMTT.js`

Checks:

- HUD shows actual current blind level.
- `Players Remaining` does not reset after CPU bust/rebalance.
- `H*/level` counter does not show stale old App counter.
- Hero action buttons are only visible when Hero is legal actor.
- No `Waiting for ... / OUT`.
- Hero bust shows overlay immediately.
- Tournament result overlay appears at completion.
- Payout/review summary is visible and does not use cash review wording.

Relevant tests:

- `src/ui/utils/__tests__/tournamentHudUtils.test.js`
- `src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx`
- `src/games/badugi/engine/__tests__/tournamentMTT.test.js`
- `tests/e2e/badugi-mtt-flow.spec.ts`
- `tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts`
- `tests/e2e/tournament/*.spec.ts`

### Core path: Badugi cash opening actor

Files likely involved:

- `src/ui/App.jsx`
- `src/ui/utils/actorSourceOfTruth.js`
- `src/games/core/turn/actorEligibility.js`
- `src/games/badugi/flow/nextActorUtils.js`
- `src/games/badugi/flow/actionUtils.js`

Checks:

- First actor is legal.
- CPU/Hero action does not stall.
- Controls are hidden when not Hero turn.
- No all-in/folded/out seat becomes actor.

Relevant tests:

- `src/ui/__tests__/badugiCashOpeningActorSnapshotRegression.test.jsx`
- `tests/e2e/badugi-cash-opening-actor-freeze.spec.ts`
- `tests/e2e/core5-cash-opening-cpu-action-regression.spec.ts`

### Core path: DRAW operations

Files likely involved:

- `src/ui/App.jsx`
- `src/ui/components/Controls.jsx`
- `src/ui/game/draw/*`
- `src/games/draw/*`
- `src/games/badugi/flow/actionUtils.js`
- `src/games/core/turn/actorEligibility.js`

Checks:

- Draw button is tappable.
- Draw count matches selected cards.
- Folded/busted/all-in rules match variant.
- BET to DRAW transition does not stall.
- DRAW to BET/SHOWDOWN transition reaches result.

Relevant tests:

- `src/ui/__tests__/drawControls.test.jsx`
- `src/ui/__tests__/badugiTournamentBetToDrawSnapshotRegression.test.jsx`
- `src/ui/__tests__/badugiFoldedDrawWaitingRegression.test.jsx`
- `src/games/testing/regression/gameProgressKnownBugs.test.js`
- `tests/e2e/badugi-tournament-bet-to-draw-regression.spec.ts`
- `tests/e2e/core5-draw-allin-eligibility-regression.spec.ts`

### Core path: iPhone layout and PWA

Files likely involved:

- `src/ui/components/MobileOrientationGate.jsx`
- `src/ui/screens/layouts/MobileGameLayout.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/components/TournamentHUD.jsx`
- `public/manifest.webmanifest`
- `vite.config.js`

Checks:

- Safari normal mode landscape fits controls inside `visualViewport`.
- PWA standalone works but is not required for basic play.
- HUD and rail collapse before action buttons clip.
- No horizontal overflow.
- Action buttons can be trial-clicked.

Relevant tests:

- `tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts`
- `tests/e2e/mobile-tournament-visual-viewport.spec.ts`
- `tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts`
- `tests/e2e/core5-mobile-tournament-portrait-layout.spec.ts`
- `tests/e2e/core5-mobile-tournament-landscape-layout.spec.ts`
- `tests/e2e/mobile-layout-mode-regression.spec.ts`

## Risk Areas in MGX

### App.jsx

Risk:

- It is a large orchestrator with timing dependencies between React state,
  refs, controller snapshots, session state, tournament state, and E2E hooks.

Do:

- Keep diffs surgical.
- Add targeted regression tests.
- Prefer canonical state/snapshot helpers.

Do not:

- Add broad new root game state.
- Rewrite actor flow.
- Split the file casually.
- Add unscoped console logging.

### Badugi runtime and actor eligibility

Risk files:

- `src/games/badugi/flow/actionUtils.js`
- `src/games/badugi/flow/nextActorUtils.js`
- `src/games/badugi/flow/betRoundUtils.js`
- `src/games/badugi/engine/roundFlow.jsx`
- `src/games/badugi/engine/roundFlow.js`
- `src/games/core/turn/actorEligibility.js`
- `src/ui/utils/actorSourceOfTruth.js`

Key invariant:

- All-in seats are excluded from BET but can still be included in DRAW where
  variant rules require all-in draw progression.

### Tournament MTT

Risk file:

- `src/games/badugi/engine/tournamentMTT.js`

Key invariant:

- Tournament MTT helpers are pure/immutable.
- App state must follow engine canonical state for level/player count.
- Rebalance must not reset players remaining.
- `TABLE_FINISHED` is terminal.

### HUD

Risk files:

- `src/ui/components/TournamentHUD.jsx`
- `src/ui/utils/tournamentHudUtils.js`
- `src/ui/App.jsx`

Key invariant:

- `playersRemaining` and `totalEntrants` should come from canonical tournament
  state first.
- Blind display should match the actual App blind structure used for the hand.

### Hero bust / TABLE_FINISHED

Risk files:

- `src/ui/App.jsx`
- `src/ui/components/HeroBustOverlay.jsx`
- `src/ui/components/TournamentResultOverlay.jsx`

Key invariant:

- After Hero bust, normal actor flow must not show `Waiting for ... / OUT`.
- Overlay should appear immediately.
- Background fast-forward can update summary, but must not revive actor.

### Mobile/PWA layout

Risk files:

- `src/ui/screens/layouts/MobileGameLayout.jsx`
- `src/ui/screens/layouts/GameLayoutBase.jsx`
- `src/ui/components/MobileOrientationGate.jsx`
- `src/ui/qa/*`
- `public/manifest.webmanifest`
- `vite.config.js`

Key invariant:

- iPhone Safari visual viewport is the source of truth for available height.
- PWA standalone helps but does not replace Safari validation.

### AI/RL/evaluator

Risk files:

- `src/ai/iron/verifyStep*.js`
- `src/ai/evaluation/*`
- `src/rl/*`
- model registry and ONNX assets.

Key invariant:

- Do not mutate AI governance, evaluation reports, or model assets unless the
  task explicitly targets them.

## Existing Tests/Scripts

### Fastest useful unit gates

```bash
npm run test:game:known-bugs
npx vitest run src/ui/utils/__tests__/tournamentHudUtils.test.js
npx vitest run src/ui/__tests__/tournamentHeroBustFlowRegression.test.jsx
npx vitest run src/games/badugi/engine/__tests__/tournamentMTT.test.js
```

### Stronger pre-merge gates

```bash
npm run test:mgx:safety
npm run test:game:progress
npm run test:rl:safety
```

### Mobile/PWA gates

```bash
npx playwright test tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts --project=badugi-flow
npx playwright test tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow
npx playwright test tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts --project=badugi-flow
npm run test:soak:mobile
```

### Tournament gates

```bash
npx vitest run src/games/badugi/engine/__tests__/tournamentMTT.test.js
npx playwright test tests/e2e/core5-tournament-rebalance-lifecycle.spec.ts --project=badugi-flow
npx playwright test tests/e2e/core5-tournament-full-lifecycle-gate.spec.ts --project=badugi-flow
npx playwright test tests/e2e/tournament/*.spec.ts --project=badugi-flow
```

### Deploy/health scripts

```bash
npm run build
./scripts/deploy/check_mgx_health.sh https://mgx-poker.com
curl -fsS https://mgx-poker.com/api/health
```

`scripts/deploy/mgx-prod-01.sh` exists, but should be treated as a release
operation requiring explicit human approval.

## Missing Pieces

### iPhone QA checklist

This audit creates a first pass, but it should be split into a shorter
operator-facing checklist:

- `docs/qa/MGX_IPHONE_REAL_DEVICE_QA_CHECKLIST.md`

### Mobile/PWA regression tests

Existing tests are good, but a curated smoke command would help:

- `npm run test:mobile:iphone`
- `npm run test:mobile:pwa`
- `npm run test:tournament:mobile`

These scripts should wrap the existing Playwright specs rather than introduce
new logic.

### scripts

Missing convenience scripts:

- `status:quick`: print branch, status, last commit, changed files.
- `test:tournament:focused`: HUD + Hero bust + MTT tests.
- `test:iphone:focused`: iPhone Safari controls + visual viewport tests.
- `preview:local`: standard Vite preview host/port command.
- `health:live`: wrapper for live health and frontend checks.

### docs

Missing docs:

- Termius/code-server operation guide.
- Dev `/dev/` preview validation guide.
- Commit staging policy for dirty worktrees.
- Claude/Codex prompt template library.
- Mobile QA artifact naming convention.

### code-server/Termius operation notes

Needs a short runbook with:

- How to start/stop dev server sessions.
- How to tail logs without flooding the phone.
- How to copy small diffs safely.
- How to avoid terminal multiplexer mistakes.
- How to stage explicit paths only.

### dev preview confirmation

Need one doc that confirms:

- Whether `/dev/` is routed through nginx on the current host.
- Which service owns the dev server lifecycle.
- How to verify HMR from iPhone Safari.
- How to distinguish live production `/` from dev `/dev/`.

## Recommended Next Codex Tasks

P0:

1. Create `docs/qa/MGX_IPHONE_REAL_DEVICE_QA_CHECKLIST.md`.
   - Convert this audit into a one-screen checklist for physical iPhone QA.
   - Include exact evidence packet fields.
   - Include `?mgxQa=mobile` and freeze/CPU export steps.

P1:

2. Add package scripts for focused iPhone/mobile/tournament gates.
   - `test:tournament:focused`
   - `test:iphone:focused`
   - `health:live`
   - Keep them wrappers around existing tests.

3. Create `docs/dev/MGX_TERMIUS_CODE_SERVER_RUNBOOK.md`.
   - Include Termius shell flow, code-server RV flow, and safe commit flow.

4. Create `docs/dev/MGX_DEV_PREVIEW_IPHONE_CHECK.md`.
   - Document `/dev/`, HMR, nginx, backend proxy, and iPhone Safari check.

5. Add a tiny script or doc snippet for safe staging.
   - The repo often has unrelated dirty docs/reports.
   - The safe default must be explicit path staging.

P2:

6. Add a Playwright "manual artifact capture" helper doc for live iPhone QA.
7. Add a lightweight dashboard page or debug route listing build info, QA
   session ID, and active E2E/mobile hooks.

## Do Not Touch / Safety Rules

- Do not run deploy scripts without explicit release approval.
- Do not push unless explicitly asked.
- Do not use `git add .`.
- Do not commit unrelated dirty docs/reports.
- Do not run heavy AI evaluation from iPhone unless explicitly requested.
- Do not modify `src/ai/iron/verifyStep*.js` casually.
- Do not rewrite `src/ui/App.jsx`.
- Do not change Badugi betting, DRAW, showdown, roundFlow, RL, evaluator, or CPU
  strategy unless the task explicitly targets that layer.
- Do not change `tournamentMTT.js` rebalance logic casually.
- Do not close physical QA blockers without physical device evidence.
- Do not close telemetry blockers without deployed sessionId evidence.
- Do not put real passwords, API keys, OpenAI keys, cookies, or production
  credentials in prompts, docs, screenshots, or commits.
- If actor/order, terminal/result, mobile controls, stale turn, or BET/DRAW
  mixed state fails, stop new work and record the failing command/artifact first.
