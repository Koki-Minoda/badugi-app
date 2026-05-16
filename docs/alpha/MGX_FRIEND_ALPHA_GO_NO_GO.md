# MGX Friend Alpha GO / NO-GO

Date: 2026-05-17

## Decision

`HOLD_FOR_LIVE_TOURNAMENT_RESULT_PATH_REMOTE_SYNC_AND_PHYSICAL_QA`

The live URL is the release source of truth for this gate. `https://mgx-poker.com/` is healthy and the latest `reports/alpha/live-deploy-verification.json` records deployed commit matching local head. The prior live tournament browser fatal (`applyPlayerAction is not a function` / `advanceStreet is not a function`) is fixed live, and live Core5 layout evidence passes 30/30. Friend alpha still remains HOLD because live Core5 alpha smoke does not reach tournament result/next-hand for D01/D02/S01/S02, remote push is blocked by missing credentials, and physical mobile QA is still pending.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | BLOCKED / unresolved |
| Live deploy snapshot | PASS, live commit == local head in latest deploy verification report |
| Badugi alpha availability | HOLD for friend exposure until full live smoke and physical QA clear |
| Badugi raise/call betting closure | PASS for no-reraise closure on live; re-raise-positive live proof remains incomplete |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| D01 2-7TD active status | PASS |
| Core 5 actor order | PASS, per-action history audit |
| Core 5 orientation support | PASS |
| Core 5 mobile tournament portrait/landscape | PASS on live URL, 30/30 layout evidence cases |
| Live Core5 cash/tournament layout evidence | PASS for Badugi/D01/D02/S01/S02 at 390x844, 430x932, and 844x390 |
| Live Core5 tournament runtime fatal | PASS, 5/5 fatal guard cases |
| Live Core5 alpha smoke | FAIL, D01/D02/S01/S02 tournament result/next-hand path not reached in smoke budget |
| Live Core5 action order | PASS, 63 audited betting actions, 0 invalid actor rows |
| Core5 Cash lifecycle invariant gate | PASS locally, 6,000 synthetic hands / 60 sessions / 0 violations; 5/5 full browser lifecycle variants; 25/25 individual Cash checks |
| Core5 Tournament lifecycle invariant gate | PASS locally, 1,200 synthetic tournaments / 0 violations; 5/5 full browser lifecycle variants; 30/30 individual Tournament checks |
| Tournament integration expansion | PASS locally, 90-row sweep / 0 violations; unit integration 28/28; tournament E2E integration 50/50 |
| Physical mobile QA | PENDING, no physical device available in this environment |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | `CORE5-TOUR-LIVE-001` live tournament result path; Badugi re-raise-positive proof incomplete |
| Badugi friend-alpha exposure | HOLD until live full smoke and physical mobile QA pass |

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

Fix the live tournament result/next-hand path, rerun `live-core5-alpha-smoke`, complete the Badugi re-raise-positive live closure proof or explicitly classify it as unsupported by the test harness, run physical mobile QA on at least Android Chrome or iPhone Safari/Chrome, and push `feature/d-04-next-actor-unify` from a credentialed environment. Only then can the Core5 friend alpha move from HOLD to GO.

Badugi should be watched closely in alpha: Step6 clears the Badugi portrait mobile UI blocker, Step7 clears the automated long-run active-pot / terminal-transition blocker, and live no-reraise closure evidence confirms the raiser is not reselected after all remaining players call/fold. The live re-raise-positive path still needs a stronger proof before Badugi is considered fully certified.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.

The latest live Core5 betting-order reality audit records expected-vs-actual samples for Badugi/D01/D02/S01/S02. It found no invalid actor rows and no hero-control mismatch rows. The reported BB case is treated as `FALSE_ALARM_CONFIRMED_BY_HISTORY`, not a P0, because live action history shows actors match canonical order.
