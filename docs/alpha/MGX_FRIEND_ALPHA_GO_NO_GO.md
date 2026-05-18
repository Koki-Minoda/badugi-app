# MGX Friend Alpha GO / NO-GO

Date: 2026-05-18

## Decision

`HOLD_FOR_PHYSICAL_MOBILE_BADUGI_P0_AND_REMOTE_SYNC`

The live URL is the release source of truth for deploy gates, and the browser gameplay invariant harness is the browser source of truth for action-by-action UI/controller consistency. The preview deploy now matches local head `72e306f9e3dde6ea0c1f71b39dafda4b10889ba0`, including the Core5 progression fixes through `22c0e7c`. Physical mobile QA still found Badugi tournament P0s on the live preview: hand 5/5 can stay on `Waiting for other players...` at BET Draw2 / Bet Round 2 with To Call 0 and Pot 66, and a follow-up report says a closed BET round can fail to transition into DRAW. A separate DRAW/BET divergence screenshot remains open. Friend alpha is HOLD until these physical mobile blockers are fixed, deployed, and rechecked on a real device. Remote push/sync is also unresolved.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | BLOCKED / unresolved, branch ahead origin by 104 commits at `72e306f` |
| Physical mobile Badugi tournament waiting freeze | P0 OPEN, `PHYSICAL-MOBILE-BADUGI-WAITING-001` |
| Physical mobile Badugi BET to DRAW transition | P0 FIXED_LOCAL / NEEDS_LIVE_AND_PHYSICAL_RECHECK, `BADUGI-BET-DRAW-TRANSITION-001` |
| Physical mobile Badugi DRAW/BET divergence | P0 OPEN, `BADUGI-DRAW-BET-MIX-001`, separate follow-up after waiting freeze |
| Core5 phase machine integrity | PASS_LOCAL / MONITOR, legal graph / impossible transition / DRAW-BET mixed / stale merge detectors pass focused regressions and Core5 browser matrix gates with 0 P0 |
| Live deploy snapshot | PASS, live commit == local head in latest deploy verification report |
| Live post-deploy Core5 smoke after progression fixes | PARTIAL, 24/30 gameplay cases PASS; 6 Triple Draw cases blocked before launch by live `/auth/signup` 504 |
| Badugi alpha availability | HOLD for friend exposure until physical QA and remote sync clear |
| Badugi raise/call betting closure | PASS live for no-reraise closure and re-raise-positive reopen proof |
| Badugi fold event logging | PASS local, hero-fold / position-specific fold / consecutive-hand reset covered |
| Core5 all-in draw eligibility | PASS local, all-in players are BET-ineligible but DRAW/showdown/pot eligible for D01/D02/S01/S02 |
| Core5 all-in hand visibility | PASS local, draw games are showdown-only reveal and board games are action-complete reveal |
| Single Draw pot semantics | PASS local, active snapshots expose effective pot including blind/current street commitments |
| Core5 CPU cash strategy sanity | P1 OPEN / SOURCE_CONFIRMATION_NEEDED, rule-based D01/D02/S01/S02 controller path is not fold-heavy, but `--cpu=rl` pro-overlay path is extremely nitty in 6max cash |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| D01 2-7TD active status | PASS |
| Core 5 actor order | PASS, per-action history audit |
| Core 5 orientation support | PASS |
| Core 5 mobile tournament portrait/landscape | PASS on live URL, 30/30 layout evidence cases |
| Live Core5 cash/tournament layout evidence | PASS for Badugi/D01/D02/S01/S02 at 390x844, 430x932, and 844x390 |
| Live Core5 tournament runtime fatal | PASS, 5/5 fatal guard cases |
| Live browser gameplay smoke | PRIOR FULL PASS; latest post-deploy smoke PARTIAL due live auth 504 before launch, not a gameplay invariant failure |
| Live Core5 desktop browser matrix | PASS, 200/200 hands complete; monitor-only PHASE/POT rows |
| Live Core5 mobile browser matrix | PASS, 200/200 hands complete; monitor-only PHASE rows |
| Live Core5 alpha smoke | Superseded by live browser gameplay matrix; previous tournament result blocker not reproduced |
| Live Core5 action order | PASS, 63 audited betting actions, 0 invalid actor rows |
| Core5 Cash lifecycle invariant gate | PASS locally, 6,000 synthetic hands / 60 sessions / 0 violations; 5/5 full browser lifecycle variants; 25/25 individual Cash checks |
| Core5 Tournament lifecycle invariant gate | PASS locally, 1,200 synthetic tournaments / 0 violations; 5/5 full browser lifecycle variants; 30/30 individual Tournament checks |
| Tournament integration expansion | PASS locally, 90-row sweep / 0 violations; unit integration 28/28; tournament E2E integration 50/50 |
| Browser gameplay invariant gate | CORE5 STEP F PASS on live preview; local desktop/mobile matrices also pass |
| Physical mobile QA | ACTIVE / BLOCKED, physical iPhone live QA found Badugi P0s that still need fix/deploy/recheck |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | None confirmed in live browser gameplay matrix; physical mobile Badugi P0s remain open |
| Badugi friend-alpha exposure | Live browser matrix and betting-closure proof pass; HOLD remains for physical mobile QA and remote sync |

## Alpha Scope

| Variant | Status |
| --- | --- |
| Badugi | alpha candidate |
| D01 | alpha candidate |
| D02 | alpha candidate |
| S01 | alpha candidate |
| S02 | alpha candidate |
| Chinese/OFC | coming soon |
| Board/Omaha/Stud/Razz/Dramaha families | preview-only or unavailable for friend alpha |

## Remaining Required Action

Recheck the physical Badugi mobile P0s against `https://mgx-poker.com/?mgxQa=mobile`, rerun the 6 live smoke rows that hit `/auth/signup` 504, confirm the live CPU decision source for cash games, complete Android Chrome and iPhone Safari/Chrome QA, and push `feature/d-04-next-actor-unify` from a credentialed environment. Only then can the Core5 friend alpha move from HOLD to GO.

Badugi should be watched closely in alpha: Step6 clears the Badugi portrait mobile UI blocker, Step7 clears the automated long-run active-pot / terminal-transition blocker, live no-reraise closure evidence confirms the raiser is not reselected after all remaining players call/fold, and live re-raise-positive evidence confirms Hero action reopens only after an opponent re-raises.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.

The remaining Core5 progression P1 rows from the release audit are now fixed locally and downgraded to monitor: `27TD-PROG-001`, `A5TD-PROG-001`, `27SD-PROG-001`, `A5SD-PROG-001`, `SD-POT-001`, `BADUGI-PROG-002`, and `BADUGI-BET-REOPEN-001`. `CORE5-ALLIN-VISIBILITY-001` adds the variant-family visibility rule: Core5 draw hands stay hidden until showdown, while board-game all-in hands can reveal only after action completion. This does not change the overall HOLD decision because physical mobile Badugi P0s and remote sync remain open.

The latest live Core5 betting-order reality audit records expected-vs-actual samples for Badugi/D01/D02/S01/S02. It found no invalid actor rows and no hero-control mismatch rows. The reported BB case is treated as `FALSE_ALARM_CONFIRMED_BY_HISTORY`, not a P0, because live action history shows actors match canonical order.
