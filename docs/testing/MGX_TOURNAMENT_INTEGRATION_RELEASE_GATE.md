# MGX Tournament Integration Release Gate

Date: 2026-05-17

## Decision

`LOCAL_AUTOMATED_PASS_LIVE_AND_PHYSICAL_PENDING`

Tournament-specific integration checks pass locally for Core5. This does not override the existing friend-alpha HOLD because live deploy/runtime and physical mobile blockers remain separate gates.

## Required Gate Results

| Category | Required Result | Local Result | Evidence |
|---|---|---|---|
| Blind progression | level and blind transitions safe | PASS | `blindLevelProgression.test.js`; `blind-level-progression.spec.ts` |
| Button / blind assignment | valid button/SB/BB, HU policy, busted seats skipped | PASS | `buttonBlindAssignment.test.js`; `button-blind-assignment.spec.ts` |
| Table rebalance | no duplicate/missing/reseated busted players | PASS | `tableRebalance.test.js`; `table-rebalance.spec.ts` |
| Bust / placement | unique placements and safe bust path | PASS | `bustPlacementPayout.test.js`; `bust-placement-payout.spec.ts` |
| Payout | payout sum preserved and ITM/bubble policy checked | PASS | `bustPlacementPayout.test.js`; sweep report |
| All-in / side pot | side pot totals and eligibility policy checked | PASS | `allinSidepotTournament.test.js`; `allin-sidepot.spec.ts` |
| Start / resume / retire | snapshot start/resume/fallback and menu return safe | PASS | `startResumeRetire.test.js`; `start-resume-retire.spec.ts` |
| Hero lifecycle | hero loss/bust/champion/menu path safe | PASS | `heroLifecycle.test.js`; `hero-lifecycle.spec.ts` |
| CPU lifecycle | CPU simulation, bust, champion, no freeze | PASS | `cpuLifecycle.test.js`; `cpu-lifecycle.spec.ts` |
| Feedback / coaching | payload and terminal replay/feedback path safe | PASS | `feedbackCoachingTournament.test.js`; `feedback-coaching.spec.ts` |
| HUD / mobile | HUD, pot, phase, controls visible in tournament path | PASS | `tournament-hud-ui.spec.ts` |
| Champion lifecycle | final player selected and terminal path safe | PASS | `bustPlacementPayout.test.js`; `cpuLifecycle.test.js`; E2E terminal specs |
| Menu return | return to menu after terminal/retire paths | PASS | `start-resume-retire.spec.ts`; terminal E2E specs |

## Executed Commands

```bash
node scripts/run-tournament-integration-sweep.js --variants=badugi,D01,D02,S01,S02 --seeds=20260601,20260602 --fast
npm test -- src/tournament/__tests__
npx playwright test tests/e2e/tournament/blind-level-progression.spec.ts tests/e2e/tournament/button-blind-assignment.spec.ts tests/e2e/tournament/table-rebalance.spec.ts tests/e2e/tournament/bust-placement-payout.spec.ts tests/e2e/tournament/allin-sidepot.spec.ts tests/e2e/tournament/start-resume-retire.spec.ts tests/e2e/tournament/hero-lifecycle.spec.ts tests/e2e/tournament/cpu-lifecycle.spec.ts tests/e2e/tournament/feedback-coaching.spec.ts tests/e2e/tournament/tournament-hud-ui.spec.ts --project=badugi-flow
```

## Summary

| Metric | Result |
|---|---:|
| Sweep rows | 90 |
| Sweep invariant violations | 0 |
| Unit/integration test files | 9 |
| Unit/integration assertions | 28 |
| E2E tournament integration checks | 50 |
| E2E failures | 0 |

## Remaining Non-Local Gates

| Gate | Status |
|---|---|
| Live deploy snapshot | HOLD, live build differs from local branch |
| Live D01/D02/S01/S02 tournament runtime | HOLD until previous live `applyPlayerAction is not a function` evidence is fixed/rechecked |
| Badugi betting closure live verification | HOLD |
| Physical mobile QA | HOLD |
| Remote push/sync | HOLD |
