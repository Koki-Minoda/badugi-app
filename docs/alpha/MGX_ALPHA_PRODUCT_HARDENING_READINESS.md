# MGX Alpha Product Hardening Readiness

Date: 2026-05-17

## Decision

`HOLD_FOR_CORE5_BROWSER_MATRIX_STEP_B_LIVE_TOURNAMENT_RESULT_PATH_REMOTE_SYNC_AND_PHYSICAL_QA`

Badugi focused raise/call no-reraise closure is P0-clean in the new browser trace, and the Browser Gameplay Invariant Badugi ladder now passes Badugi cash desktop 1-hand, 10-hand, and 100-hand runs. The earlier hand16 100-hand halt is classified as progress-helper stale-read / terminal and next-hand detection, with the focused repro now completing through hand20. The allowed Badugi-only cash/tournament x desktop/portrait/landscape matrix also completed 120/120 hands. Core5 browser expansion has started: cash desktop 10-hand passes, but cash desktop 100-hand fails and blocks further expansion. Friend alpha is still blocked because Core5 browser Step B is not clean, live Core5 alpha smoke fails to reach tournament result/next-hand for D01/D02/S01/S02, remote sync is unresolved, and physical mobile QA is pending.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| live deploy snapshot | PASS | live build info matches local head in `reports/alpha/live-deploy-verification.json` |
| live health | PASS | `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}` |
| build | PASS | `npm run build` succeeds |
| Badugi playable | PARTIAL_LIVE_VERIFY / HOLD | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; live no-reraise raise/call closure passes; re-raise-positive live proof remains incomplete |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes Badugi/D01/D02/S01/S02 on cash portrait, cash landscape, tournament portrait, tournament landscape, interaction, and desktop |
| Core 5 live layout evidence | PASS | 30/30 live cash/tournament portrait/landscape evidence cases pass; screenshots under `reports/screenshots/live-core5-v2-*.png` |
| Core 5 live tournament fatal guard | PASS | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts` passes 5/5 after the tournament runtime fix deploy |
| Core 5 live alpha smoke | FAIL | D01/D02/S01/S02 cash result/next-hand passes, but tournament result/next-hand is not reached inside smoke budget; Badugi tournament can also stall in final `BET` with stale top-level `turn` |
| Core 5 active status | PENDING recheck after config change | Badugi/D01/D02/S01/S02 should be alpha-playable and launchable |
| Core 5 actor order | PASS | live action-history audit across Badugi/D01/D02/S01/S02 recorded expected vs actual actor samples and found 0 invalid actor rows / 0 hero-control mismatches |
| Core 5 orientation | PASS | cash and tournament support portrait and landscape for Badugi/D01/D02/S01/S02 |
| Core 5 full lifecycle invariants | PASS locally | Cash: 6,000 synthetic hands / 60 sessions / 0 violations plus 5/5 full browser lifecycle variants and 25/25 individual Cash checks. Tournament: 1,200 synthetic tournaments / 0 violations plus 5/5 full browser lifecycle variants and 30/30 individual Tournament checks |
| Tournament integration expansion | PASS locally | 90-row deterministic tournament integration sweep / 0 violations, 9 unit/integration files / 28 assertions PASS, and 50/50 Core5 tournament E2E integration checks PASS across blind progression, button/blinds, rebalance, bust/placement, payout, all-in/side-pot, resume/retire, hero/CPU lifecycle, feedback, HUD/mobile, champion, and menu return |
| Browser gameplay invariant gate | CORE5_STEP_B_FAIL | Badugi ladder passes; Core5 cash desktop 10-hand passes; Core5 cash desktop 100-hand fails with action-application and UI/controller divergence rows |
| Triple Draw actor order | PASS | D01/D02/S01/S02 mapping audited; 6max/5max/3way pre-draw actor starts left of BB; heads-up blind/button actor semantics fixed |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| Badugi raise/call betting closure | PARTIAL_LIVE_PASS | live no-reraise closure passes without Hero re-action; live re-raise-positive path currently fails to force/apply the opponent re-raise in the audit harness |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Fix live Core5 tournament result/next-hand path | live tournament runtime no longer fatals, but D01/D02/S01/S02 do not reach result/next-hand in the release smoke |
| P0 | Fix Core5 browser cash desktop 100-hand matrix failures | Step B found action-application failures and S01/S02 UI/controller divergence, so tournament/mobile/live matrix expansion is blocked |
| P1 | Complete Badugi re-raise-positive live closure proof | no-reraise closure passes live, but the positive re-raise reopen proof is incomplete |
| P1 | Refresh live deploy snapshot after the next fix | current deploy matches the latest verification report; rerun after any new fix |
| P1 | Push deployed local commits | preview deploy used a local branch ahead of origin by many commits |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P1 | Recheck mobile tournament layout on real Safari/Chrome | automation passes, but this was originally found on real-device/browser tournament views |
| P1 | Deploy and live-run the Core5 lifecycle gate evidence | local Cash/Tournament lifecycle automation passes, but live build and live tournament runtime remain the release source of truth |
| P1 | Re-run tournament integration gate after live runtime fix | local tournament integration expansion passes, but the live tournament runtime fatal must be fixed/redeployed before this can contribute to friend-alpha GO |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Run Badugi physical mobile full-hand QA | Step6/Step7 automation passes, but real mobile pot/action/draw controls are still unchecked |
| P1 | Monitor Badugi pot/terminal/actor behavior in closed alpha | Badugi is core MGX scope, but remaining real-device risk must stay visible |

## Deploy Recommendation

Hold friend alpha. Continue only after the Browser Gameplay Invariant gate is expanded across the approved Core5 step, live Core5 tournament result/next-hand smoke passes, Badugi betting-closure proof is complete enough for release, physical mobile QA is complete, and remote sync is resolved or explicitly accepted as an operational P1.

The latest local Core5 UI audits remain useful, but they are not sufficient for release. The live URL evidence is the current source of truth: `CORE5-UI-LIVE-001` is fixed live, while `CORE5-TOUR-LIVE-001` remains the active tournament progression blocker.

The Core 5 action-order reality audit adds per-action history evidence beyond first-actor checks. It classifies the reported BB case as `FALSE_ALARM_CONFIRMED_BY_HISTORY`: BB acted only after earlier active obligations were resolved, or as the first active post-draw actor when seats left of the button were folded/ineligible.
