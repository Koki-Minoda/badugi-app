# MGX Tournament Integration Coverage Matrix

Date: 2026-05-17

## Scope

Core5 variants:

- Badugi
- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

This matrix is separate from the Core5 Cash/Tournament lifecycle invariant harness. It targets tournament-specific operating boundaries: blinds, button/blinds, rebalance, busts, payouts, all-in/side-pot policy, resume/retire, hero/CPU lifecycle, feedback, and HUD/mobile usability.

## Coverage Matrix

| Category | Case | Variant Scope | Required? | Existing Test | Gap | New Test |
|---|---|---|---|---|---|---|
| Blind / Level | level 1 starts correctly | Core5 | Yes | partial HUD/lifecycle checks | no dedicated boundary matrix | `src/tournament/__tests__/blindLevelProgression.test.js`; `tests/e2e/tournament/blind-level-progression.spec.ts` |
| Blind / Level | SB/BB values correct | Core5 | Yes | partial HUD checks | no per-variant tournament gate | same as above |
| Blind / Level | level advances at hand boundary | engine primary + Core5 smoke | Yes | `tournamentMTT.test.js` | no release-gate report | same as above |
| Blind / Level | blind does not change mid-hand | engine policy | Yes | none explicit | documented via no-completion snapshot | `blindLevelProgression.test.js` |
| Blind / Level | next level preview correct | Core5 | Yes | HUD utility tests | not in tournament integration gate | `blind-level-progression.spec.ts` |
| Blind / Level | short stack after blind increase | engine policy | Yes | none explicit | missing edge fixture | `blindLevelProgression.test.js` |
| Blind / Level | level cap/final level | engine primary | Yes | partial | no dedicated edge | `blindLevelProgression.test.js` |
| Button / Blind | first hand button assigned | engine policy | Yes | partial table tests | no explicit blind assignment fixture | `buttonBlindAssignment.test.js`; `button-blind-assignment.spec.ts` |
| Button / Blind | button rotates to next active | engine policy | Yes | partial | not matrixed | `buttonBlindAssignment.test.js` |
| Button / Blind | busted/empty seats skipped | engine policy | Yes | partial rebalance tests | no blind-specific assertion | `buttonBlindAssignment.test.js` |
| Button / Blind | HU BTN=SB | engine policy | Yes | first actor tests elsewhere | no tournament-specific assertion | `buttonBlindAssignment.test.js` |
| Button / Blind | 3+ SB/BB normal | engine policy | Yes | first actor tests elsewhere | no tournament-specific assertion | `buttonBlindAssignment.test.js` |
| Button / Blind | no duplicate blinds / BB present | engine policy | Yes | none explicit | missing edge fixture | `buttonBlindAssignment.test.js` |
| Table Rebalance | table count decreases after busts | Core5 smoke + engine | Yes | `tournamentMTT.test.js` | no Core5 e2e category | `tableRebalance.test.js`; `table-rebalance.spec.ts` |
| Table Rebalance | empty table removed | engine primary | Yes | partial | no release matrix | `tableRebalance.test.js` |
| Table Rebalance | no duplicate players | engine primary | Yes | partial | no helper invariant | `tableRebalance.test.js` |
| Table Rebalance | busted player not reseated | engine primary | Yes | partial | no explicit uniqueness result | `tableRebalance.test.js` |
| Table Rebalance | odd player count handled | engine primary | Yes | one existing case | added release gate | `tableRebalance.test.js` |
| Table Rebalance | final table formation | engine primary + Core5 smoke | Yes | `tournamentMTT.test.js` | no e2e category report | `table-rebalance.spec.ts` |
| Bust / Placement | CPU bust | Core5 | Yes | lifecycle harness | no placement/payout category | `bustPlacementPayout.test.js`; `bust-placement-payout.spec.ts` |
| Bust / Placement | hero bust | Core5 | Yes | lifecycle harness | no dedicated hero category | `heroLifecycle.test.js`; `hero-lifecycle.spec.ts` |
| Bust / Placement | multiple same-hand busts | engine primary | Yes | existing MTT test | added fixture gate | `bustPlacementPayout.test.js` |
| Bust / Placement | tie-break by start stack | engine primary | Yes | existing MTT test | added release matrix | `bustPlacementPayout.test.js` |
| Payout | unique placements | engine primary | Yes | existing MTT test | no release report | `bustPlacementPayout.test.js` |
| Payout | payout sum equals prize pool | engine primary | Yes | existing MTT test | no Core5 category | `bustPlacementPayout.test.js`; `bust-placement-payout.spec.ts` |
| Payout | ITM paid / bubble unpaid | engine primary | Yes | partial | no bubble fixture | `bustPlacementPayout.test.js` |
| Payout | champion payout | engine primary + e2e smoke | Yes | existing MTT test | no category report | `bust-placement-payout.spec.ts` |
| All-in / Side Pot | short stack all-in | engine policy | Yes | game side-pot tests elsewhere | no tournament fixture | `allinSidepotTournament.test.js`; `allin-sidepot.spec.ts` |
| All-in / Side Pot | side pot creation | engine policy | Yes | partial game tests | no tournament policy fixture | `allinSidepotTournament.test.js` |
| All-in / Side Pot | folded player ineligible | engine policy | Yes | partial game tests | no tournament policy fixture | `allinSidepotTournament.test.js` |
| All-in / Side Pot | pot total equals contributions | engine policy | Yes | partial | no tournament category | `allinSidepotTournament.test.js` |
| Start / Resume / Retire | valid new snapshot | Core5 | Yes | lifecycle harness | no resume fixture | `startResumeRetire.test.js`; `start-resume-retire.spec.ts` |
| Start / Resume / Retire | resume restores level/stacks/tables/hero | engine fixture | Yes | none explicit | added deterministic fixture | `startResumeRetire.test.js` |
| Start / Resume / Retire | missing/corrupt snapshot safe | engine fixture | Yes | none explicit | added deterministic fixture | `startResumeRetire.test.js` |
| Start / Resume / Retire | menu return | Core5 | Yes | lifecycle harness | category report missing | `start-resume-retire.spec.ts` |
| Hero Lifecycle | hero hand participation | Core5 | Yes | lifecycle harness | no category report | `heroLifecycle.test.js`; `hero-lifecycle.spec.ts` |
| Hero Lifecycle | hero fold/win/loss/all-in bust | engine fixture | Yes | partial | no unified category | `heroLifecycle.test.js` |
| Hero Lifecycle | no controls after bust / menu safe | Core5 | Yes | lifecycle harness | no category report | `hero-lifecycle.spec.ts` |
| Hero Lifecycle | hero champion | engine primary | Yes | partial | no category report | `heroLifecycle.test.js` |
| CPU Lifecycle | CPU legal action / no freeze | Core5 | Yes | lifecycle harness | no CPU category | `cpuLifecycle.test.js`; `cpu-lifecycle.spec.ts` |
| CPU Lifecycle | CPU bust / not actor | engine primary | Yes | existing MTT tests | no category report | `cpuLifecycle.test.js` |
| CPU Lifecycle | CPU champion | engine primary + e2e smoke | Yes | partial | no category report | `cpuLifecycle.test.js`; `cpu-lifecycle.spec.ts` |
| Feedback / Coaching | feedback after bust/end safe | Core5 | Yes | lifecycle harness | no feedback category | `feedbackCoachingTournament.test.js`; `feedback-coaching.spec.ts` |
| Feedback / Coaching | variantId/replay/EV fields valid | engine/payload | Yes | payload tests | no integration category | `feedbackCoachingTournament.test.js` |
| Feedback / Coaching | JP/EN text non-empty | payload | Yes | payload tests | no release matrix | `feedbackCoachingTournament.test.js` |
| Feedback / Coaching | helpful/not helpful/menu safe | Core5 smoke | Yes | UI tests elsewhere | no tournament category | `feedback-coaching.spec.ts` |
| HUD / Mobile | level/next blinds/players visible | Core5 | Yes | tournament HUD tests | no Core5 tournament integration category | `tournament-hud-ui.spec.ts` |
| HUD / Mobile | compact mobile HUD / controls visible | Core5 | Yes | Core5 mobile tournament layout tests | separate from integration matrix | `tournament-hud-ui.spec.ts` |
| HUD / Mobile | result/payout overlay safe | Core5 | Yes | lifecycle harness | no HUD category report | `tournament-hud-ui.spec.ts` |

## Result

`LOCAL_AUTOMATED_PASS`

The new deterministic fixture/unit tests, sweep script, and browser integration specs cover all required categories locally. Generated reports are under `reports/tournament/` and are not committed.
