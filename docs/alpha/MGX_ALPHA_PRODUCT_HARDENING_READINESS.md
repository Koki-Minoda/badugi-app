# MGX Alpha Product Hardening Readiness

Date: 2026-05-18

## Decision

`HOLD_FOR_PHYSICAL_MOBILE_BADUGI_P0_AND_REMOTE_SYNC`

Badugi focused raise/call no-reraise closure is P0-clean in the browser trace, and the re-raise-positive live proof passes. The Core5 local/live browser matrices remain important coverage, but physical mobile QA has found live Badugi tournament P0s: hand 5/5 can remain stuck on `Waiting for other players...` at BET Draw2 / Bet Round 2 with To Call 0 and Pot 66, and a separate DRAW/BET divergence screenshot remains open. This supersedes the previous “physical QA pending only” status. Remote sync is unresolved, and friend alpha is HOLD until the physical blockers are fixed, deployed, and rechecked.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| live deploy snapshot | PASS | live build info matches local head in `reports/alpha/live-deploy-verification.json` |
| live health | PASS | `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}` |
| physical mobile Badugi tournament waiting freeze | P0 OPEN | `PHYSICAL-MOBILE-BADUGI-WAITING-001`; iPhone live preview screenshot shows Waiting at BET Draw2 with no Hero action |
| physical mobile Badugi DRAW/BET divergence | P0 OPEN | `BADUGI-DRAW-BET-MIX-001`; tracked separately after waiting freeze |
| Core5 phase machine hardening | PASS_LOCAL / MONITOR | legal phase graph, impossible transition detector, DRAW/BET mixed-state detector, and stale phase merge detector pass focused regressions. The 50-hand Core5 matrix completed 1500/1500 hands with 0 P0, and the post-classification 5-hand matrix completed 150/150 hands with 0 impossible transition / DRAW-BET mixed / stale-merge rows. Remaining PHASE/POT rows are timing monitor only. |
| build | PASS | `npm run build` succeeds |
| Badugi playable | LIVE_BROWSER_VERIFY_PASS / HOLD_FOR_PHYSICAL_QA | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; live no-reraise raise/call closure passes; re-raise-positive live proof passes |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes Badugi/D01/D02/S01/S02 on cash portrait, cash landscape, tournament portrait, tournament landscape, interaction, and desktop |
| Core 5 live layout evidence | PASS | 30/30 live cash/tournament portrait/landscape evidence cases pass; screenshots under `reports/screenshots/live-core5-v2-*.png` |
| Core 5 live tournament fatal guard | PASS | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts` passes 5/5 after the tournament runtime fix deploy |
| Core 5 live browser gameplay smoke | PASS | 50/50 live hands complete across Core5 cash/tournament desktop; only bounded PHASE monitor rows |
| Core 5 live desktop browser matrix | PASS | 200/200 live hands complete; no actor P0, terminal P0, illegal reopen, UI/controller divergence, action application failure, or freeze |
| Core 5 live mobile browser matrix | PASS | 200/200 live mobile-emulated hands complete across portrait/landscape; no blocking gameplay invariant violation |
| Core 5 active status | PENDING recheck after config change | Badugi/D01/D02/S01/S02 should be alpha-playable and launchable |
| Core 5 actor order | PASS | live action-history audit across Badugi/D01/D02/S01/S02 recorded expected vs actual actor samples and found 0 invalid actor rows / 0 hero-control mismatches |
| Core 5 orientation | PASS | cash and tournament support portrait and landscape for Badugi/D01/D02/S01/S02 |
| Core 5 full lifecycle invariants | PASS locally | Cash: 6,000 synthetic hands / 60 sessions / 0 violations plus 5/5 full browser lifecycle variants and 25/25 individual Cash checks. Tournament: 1,200 synthetic tournaments / 0 violations plus 5/5 full browser lifecycle variants and 30/30 individual Tournament checks |
| Tournament integration expansion | PASS locally | 90-row deterministic tournament integration sweep / 0 violations, 9 unit/integration files / 28 assertions PASS, and 50/50 Core5 tournament E2E integration checks PASS across blind progression, button/blinds, rebalance, bust/placement, payout, all-in/side-pot, resume/retire, hero/CPU lifecycle, feedback, HUD/mobile, champion, and menu return |
| Browser gameplay invariant gate | CORE5_STEP_F_PASS / LIVE | Local desktop/mobile matrices pass; live smoke, desktop 20-hand, and mobile emulation matrices pass with no actor/terminal/action-reopen/UI-divergence/action-application/freeze P0 |
| Triple Draw actor order | PASS | D01/D02/S01/S02 mapping audited; 6max/5max/3way pre-draw actor starts left of BB; heads-up blind/button actor semantics fixed |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| Badugi raise/call betting closure | LIVE_PASS | live no-reraise closure passes without Hero re-action; live re-raise-positive path passes and proves only an opponent re-raise reopens Hero action |
| Badugi fold event logging | PASS_LOCAL / MONITOR | `tests/e2e/badugi-fold-event-logging-regression.spec.ts` and the `badugi-flow.spec.ts -g "fold"` subset pass for hero-fold, position-specific fold, and consecutive-hand reset paths |
| Core5 all-in draw eligibility | PASS_LOCAL / MONITOR | D01/D02/S01/S02 now enforce separate BET/DRAW/showdown eligibility: all-in seats are skipped for betting, remain draw-eligible, and retain showdown/pot eligibility |
| Single Draw pot semantics | PASS_LOCAL / MONITOR | S01/S02 active-hand snapshots now expose effective pot including blind/current street commitments, while terminal echo and next-hand reset remain separate |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push deployed local commits | branch `feature/d-04-next-actor-unify` is ahead of origin by 99 commits at `f735fca` |
| P0 | Fix physical Badugi waiting freeze | real-device live QA found `PHYSICAL-MOBILE-BADUGI-WAITING-001`; friend alpha remains HOLD |
| P0 | Reproduce/fix physical DRAW/BET divergence | real-device screenshot remains open as `BADUGI-DRAW-BET-MIX-001` even though local phase-machine detectors pass |
| P1 | Recheck mobile tournament layout on real Safari/Chrome | automation passes, but this was originally found on real-device/browser tournament views |
| P2 | Keep live browser matrix in deploy checks | live browser gameplay is now clean, but it should be rerun after any controller/UI/deploy change |
| P2 | Re-run tournament integration after future tournament changes | local tournament integration expansion passes; keep it as a regression gate |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Complete Badugi physical mobile full-hand QA after fixes | Step6/Step7 automation passes, but real mobile already found P0s and must be rechecked after deploy |
| P1 | Monitor Badugi pot/terminal/actor behavior in closed alpha | Badugi is core MGX scope, but remaining real-device risk must stay visible |

The former release-audit P1 progression rows are closed locally as monitor items: `27TD-PROG-001`, `A5TD-PROG-001`, `27SD-PROG-001`, `A5SD-PROG-001`, `SD-POT-001`, `BADUGI-PROG-002`, and `BADUGI-BET-REOPEN-001`. Friend alpha still remains HOLD because those fixes do not clear the physical mobile Badugi P0s or remote sync.

## Deploy Recommendation

Hold friend alpha. Continue only after the physical mobile Badugi P0s are fixed/deployed/rechecked and remote sync is resolved or explicitly accepted as an operational P1.

The live URL evidence is the current source of truth: `CORE5-UI-LIVE-001`, `CORE5-TOUR-LIVE-001`, and the Badugi betting-closure proof are fixed live / monitor. Remaining friend-alpha blockers are operational/physical, not a confirmed Core5 browser gameplay P0.

The Core 5 action-order reality audit adds per-action history evidence beyond first-actor checks. It classifies the reported BB case as `FALSE_ALARM_CONFIRMED_BY_HISTORY`: BB acted only after earlier active obligations were resolved, or as the first active post-draw actor when seats left of the button were folded/ineligible.
