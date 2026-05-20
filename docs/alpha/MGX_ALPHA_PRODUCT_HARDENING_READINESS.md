# MGX Alpha Product Hardening Readiness

Date: 2026-05-21

## Decision

`HOLD_FOR_PHYSICAL_MOBILE_BADUGI_RECHECK_REMOTE_SYNC_AND_TARGETED_CPU_PRESSURE_CONFIRMATION`

Badugi focused raise/call no-reraise closure is P0-clean in the browser trace, and the re-raise-positive live proof passes. The preview deploy now matches the local head `c36bc37035dc29d2f98925139199ab99031efc2e` recorded in `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json` and includes the structure presets, long-run soak gate, readability quick wins, cross-variant controller reset fix, CPU decision telemetry persistence, Badugi tournament DRAW1 CPU action fix, and Badugi pro-overlay action normalization fix; live cross-variant contamination recheck passes. The Core5 local/live browser matrices remain important coverage, but physical mobile QA has found live Badugi tournament P0s: hand 5/5 can remain stuck on `Waiting for other players...` at BET Draw2 / Bet Round 2 with To Call 0 and Pot 66, and a follow-up report says a closed BET round can fail to transition into DRAW. The focused BET-to-DRAW and DRAW1 CPU action fixes are deployed and live Badugi tournament emulation now passes portrait and landscape. A separate DRAW/BET divergence screenshot remains open until physical recheck. Remote sync is unresolved, and friend alpha is HOLD until the physical recheck, remote sync, and targeted Badugi pro-overlay pressure confirmation are cleared or explicitly accepted.

The tournament structure / AI feedback audit adds a quality WARN. Minutes-based tournament presets are viable, and the current simulated structures avoid endless heads-up by eventually forcing sub-10BB play. However, tournament CPU quality depends strongly on decision source: heuristic D01/D02/S01/S02 produces playable audit density, while pro-overlay folds `97.75%` of decisions and collapses meaningful decision density to `0.12` per hand. Badugi pro-overlay action normalization is deployed and focused live telemetry confirms the `pro-overlay` path is active without adapter mismatch rows, but the natural sample has not captured the exact BET pressure/type-alias row required to close the value-pressure bug live. This does not change gameplay rules or routing, but it keeps pro-overlay as a friend-alpha tournament opponent source under targeted telemetry confirmation.

The remaining-readiness pass adds code-level tournament preset definitions, a structure validation gate, a fast long-run soak wrapper, and low-risk table actor/action readability context. Physical QA instructions now explicitly require sessionId, CPU export, and freeze export evidence. These are supporting release gates; they do not override the physical Badugi P0 recheck requirement.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| live deploy snapshot | PASS | live build info matches local head `c36bc37035dc29d2f98925139199ab99031efc2e` in `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json` |
| live health | PASS | `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}` |
| physical mobile Badugi tournament waiting freeze | P0 OPEN | `PHYSICAL-MOBILE-BADUGI-WAITING-001`; iPhone live preview screenshot shows Waiting at BET Draw2 with no Hero action |
| physical mobile Badugi hand-shape contamination | P0 FIXED_LIVE / NEEDS_PHYSICAL_RECHECK | `BADUGI-HAND-SHAPE-001`; iPhone live preview showed Badugi tournament with five-card draw-lowball hands; deployed hand-shape and physical cross-variant regressions pass |
| physical mobile Badugi folded DRAW freeze | P0 FIXED_LIVE / NEEDS_PHYSICAL_RECHECK | `BADUGI-FOLD-DRAW-FREEZE-001`; folded Hero cannot be selected as DRAW actor; deployed engine/UI/E2E regressions pass |
| physical mobile Badugi BET to DRAW transition | P0 FIXED_LIVE / NEEDS_PHYSICAL_RECHECK | `BADUGI-BET-DRAW-TRANSITION-001`; focused local regression covers the closed BET Draw2 state and preview deploy includes `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`; live Badugi mobile emulation now passes portrait/landscape |
| live Badugi tournament DRAW1 CPU action | FIXED_LIVE / NEEDS_PHYSICAL_RECHECK | `BADUGI-DRAW1-CPU-ACTION-001`; focused local/live regression passes and Badugi tournament portrait/landscape live emulation completes 20 hands each with 0 invariant failures |
| Badugi pro-overlay action normalization | DEPLOYED / NEEDS_TARGETED_LIVE_PRESSURE_CONFIRMATION | `BADUGI-CPU-VALUE-BET-001`; local audit pro-overlay value bet and HU pressure are `100.00%` after normalization, focused live classifies `pro-overlay` with `passiveConfirmed=false` and no adapter mismatches, but no pro-overlay BET `rawActionSource=type` pressure row was captured in the natural live sample |
| physical mobile Badugi DRAW/BET divergence | P0 OPEN | `BADUGI-DRAW-BET-MIX-001`; tracked separately after waiting freeze |
| tournament busted seat readability | P1/P0 OPEN / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK | `TOUR-SEAT-LIFECYCLE-001`; physical mobile Badugi showed busted/out CPU panels remaining large enough to block table readability |
| iPhone Safari/PWA tournament landscape controls | P0 OPEN / FIXED_LOCAL_CANDIDATE | `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`; Safari URL/tab bars cannot be hidden, so Hero controls now size against `window.visualViewport` and require physical recheck |
| Badugi cash opening actor | P0 OPEN / FIXED_LOCAL_CANDIDATE | `BADUGI-CASH-OPENING-ACTOR-001`; physical iPhone Safari observed cash freeze at the first actor, and local fix syncs Badugi cash controller state at new-hand boundaries |
| cross-variant state contamination | P0 FIXED_LIVE / NEEDS_PHYSICAL_RECHECK | `CROSS-VARIANT-STATE-001`; physical Badugi reopened the class as hand-shape contamination, and deployed D01/D02/S01/S02 cash -> Badugi tournament regression now passes after ref-based variant/mode hand-start hardening |
| Core5 phase machine hardening | PASS_LOCAL / MONITOR | legal phase graph, impossible transition detector, DRAW/BET mixed-state detector, and stale phase merge detector pass focused regressions. The 50-hand Core5 matrix completed 1500/1500 hands with 0 P0, and the post-classification 5-hand matrix completed 150/150 hands with 0 impossible transition / DRAW-BET mixed / stale-merge rows. Remaining PHASE/POT rows are timing monitor only. |
| build | PASS | `npm run build` succeeds |
| Badugi playable | LIVE_BROWSER_VERIFY_PASS / HOLD_FOR_PHYSICAL_QA | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; live no-reraise raise/call closure passes; re-raise-positive live proof passes |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes Badugi/D01/D02/S01/S02 on cash portrait, cash landscape, tournament portrait, tournament landscape, interaction, and desktop |
| Core 5 live layout evidence | PASS | 30/30 live cash/tournament portrait/landscape evidence cases pass; screenshots under `reports/screenshots/live-core5-v2-*.png` |
| Core 5 live tournament fatal guard | PASS | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts` passes 5/5 after the tournament runtime fix deploy |
| Core 5 live browser gameplay smoke | PARTIAL post-deploy | 25/30 latest smoke cases reached gameplay and passed; 5 Triple Draw cases were blocked before launch by live `/auth/signup` 504, so they need auth-stable rerun |
| Core 5 live desktop browser matrix | PASS | 200/200 live hands complete; no actor P0, terminal P0, illegal reopen, UI/controller divergence, action application failure, or freeze |
| Core 5 live mobile browser matrix | PASS | 200/200 live mobile-emulated hands complete across portrait/landscape; no blocking gameplay invariant violation |
| Core5 long-run soak fast gate | PASS_WITH_MONITOR | 100/100 hands and 2,431 actions completed across Core5 cash/tournament desktop/portrait; no actor/terminal/action-application/freeze blockers; PHASE/POT monitor rows remain |
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
| Core5 all-in hand visibility | PASS_LOCAL / MONITOR | draw games are showdown-only reveal, board games can reveal after all-in action completion, and unknown variants default to showdown-only |
| Single Draw pot semantics | PASS_LOCAL / MONITOR | S01/S02 active-hand snapshots now expose effective pot including blind/current street commitments, while terminal echo and next-hand reset remain separate |
| Core5 CPU cash strategy sanity | P1 OPEN / SOURCE_CONFIRMATION_NEEDED | local telemetry shows D01/D02/S01/S02 rule-based controller CPUs are not fold-heavy, but the `--cpu=rl` pro-overlay path folds 92.6%-97.3% in 6max cash. CPU decision telemetry is deployed and needs targeted QA by sessionId. |
| Tournament structure quality | PASS_WITH_NOTES | minutes-based Store/Regional/National/World candidates are viable; Store Turbo is push/fold heavy and should remain a quick/custom preset |
| Tournament CPU realism | WARN / P1 | heuristic path is not fold-heavy, but pro-overlay tournament path folds 97.75% and is not alpha-ready as a gameplay experience; Badugi action normalization is deployed but still needs targeted pressure telemetry |
| Tournament meaningful decision density | WARN / SOURCE_DEPENDENT | heuristic has 16.29 meaningful decisions per hand; pro-overlay has 0.12; Badugi local focused adapter density is 66.67%, but live natural telemetry has not captured enough BET pressure rows to close the row |
| Table action readability quick wins | IMPROVED_LIVE / MONITOR | decision panel now mirrors Hero position, current actor, waiting target, and recent actions; live readability smoke passes 10/10; replay grouping remains future P1 work |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push deployed local commits | branch `feature/d-04-next-actor-unify` remains ahead of origin and requires credentialed push |
| P0 | Fix physical Badugi waiting freeze | real-device live QA found `PHYSICAL-MOBILE-BADUGI-WAITING-001`; friend alpha remains HOLD |
| P0 | Recheck Badugi hand-shape and folded-DRAW fix on physical device | deployed regressions pass for `BADUGI-HAND-SHAPE-001`, `BADUGI-FOLD-DRAW-FREEZE-001`, and reopened `CROSS-VARIANT-STATE-001`; real-device recheck still required |
| P0 | Clear physical Badugi DRAW1 / BET→DRAW recheck | local and live emulation fixes pass for `BADUGI-DRAW1-CPU-ACTION-001` and `BADUGI-BET-DRAW-TRANSITION-001`, but physical mobile recheck has not passed |
| P0 | Clear iPhone Safari/PWA landscape action clipping | normal Safari and PWA standalone must show fully tappable Hero action buttons inside the visual viewport |
| P0 | Clear Badugi cash opening actor freeze | physical iPhone Safari cash start must progress from the first CPU/Hero opening actor without waiting freeze |
| P1 | Physical recheck cross-variant reset | live cross-variant regression passes; real-device D01 cash -> Cash Out/Menu -> Badugi tournament must still be rechecked after DRAW1 fix |
| P0 | Reproduce/fix physical DRAW/BET divergence | real-device screenshot remains open as `BADUGI-DRAW-BET-MIX-001` even though local phase-machine detectors pass |
| P1 | Recheck mobile tournament layout on real Safari/Chrome | automation passes, but this was originally found on real-device/browser tournament views |
| P1 | Confirm live CPU decision source | physical preview cash felt fold-heavy; local telemetry points to pro-overlay nit behavior if that path is active live |
| P1 | Confirm Badugi pro-overlay pressure normalization in live BET spots | deploy and runtime source are confirmed, but a targeted live/physical session must capture `decisionSource=pro-overlay`, `rawActionSource=type`, and canonical `finalAction=raise/bet` in a legal pressure spot |
| P1 | Confirm tournament CPU source | tournament audit shows pro-overlay is too nit/passive; friend-alpha tournaments should use a confirmed non-pro-overlay path or wait for tuning |
| P2 | Lock minutes-based tournament presets | Store/Regional/National/World structure candidates are documented; preserve eventual sub-10BB pressure to avoid endless HU |
| P2 | Keep live browser matrix in deploy checks | live browser gameplay is now clean, but it should be rerun after any controller/UI/deploy change |
| P2 | Keep fast long-run soak in local release checks | fast soak completes without hard blockers, while PHASE/POT monitor rows remain tracked separately |
| P2 | Re-run tournament integration after future tournament changes | local tournament integration expansion passes; keep it as a regression gate |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Complete Badugi physical mobile full-hand QA after fixes | Step6/Step7 automation passes, but real mobile already found P0s and must be rechecked after deploy |
| P1 | Monitor Badugi pot/terminal/actor behavior in closed alpha | Badugi is core MGX scope, but remaining real-device risk must stay visible |

The former release-audit P1 progression rows are closed locally as monitor items: `27TD-PROG-001`, `A5TD-PROG-001`, `27SD-PROG-001`, `A5SD-PROG-001`, `SD-POT-001`, `BADUGI-PROG-002`, and `BADUGI-BET-REOPEN-001`. `CORE5-ALLIN-VISIBILITY-001` is also fixed local / monitor. Friend alpha still remains HOLD because the live fixes require real physical mobile recheck, remote sync, and targeted Badugi pro-overlay pressure confirmation.

## Deploy Recommendation

Hold friend alpha. Continue only after the physical mobile Badugi P0s are fixed/deployed/rechecked, remote sync is resolved or explicitly accepted as an operational P1, and the Badugi pro-overlay pressure normalization has targeted live/physical evidence in a legal BET spot.

The live URL evidence is the current source of truth: the latest deploy snapshot, Badugi betting-closure proof, focused DRAW1 CPU regression, Badugi pro-overlay action normalization deploy, and Badugi tournament portrait/landscape live emulation pass. Remaining friend-alpha blockers are physical mobile Badugi P0 recheck, remote sync, targeted Badugi pro-overlay pressure telemetry, and broader CPU telemetry QA.

The Core 5 action-order reality audit adds per-action history evidence beyond first-actor checks. It classifies the reported BB case as `FALSE_ALARM_CONFIRMED_BY_HISTORY`: BB acted only after earlier active obligations were resolved, or as the first active post-draw actor when seats left of the button were folded/ineligible.
