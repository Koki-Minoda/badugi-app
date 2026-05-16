# MGX Friend Alpha GO / NO-GO

Date: 2026-05-16

## Decision

`HOLD_FOR_BADUGI_BETTING_CLOSURE_LIVE_VERIFY_AND_LIVE_TOURNAMENT_RUNTIME`

The live URL is the release source of truth for this gate. `https://mgx-poker.com/` is healthy, but its frontend build info reports deployed commit `f2c36e7ec833153b8428da07918bf7c8fb3ee234`, not the current local branch. Live evidence also shows D01/D02/S01/S02 tournament mode fails with browser fatal `applyPlayerAction is not a function` across portrait and landscape mobile viewports. A user-reported live Badugi raise/call closure bug is now fixed locally by action-history regression, but it is not live-deployed or live-verified yet. Friend alpha remains HOLD.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | BLOCKED / unresolved |
| Live deploy snapshot | FAIL, live `f2c36e7` != current local branch |
| Badugi alpha availability | HOLD for friend exposure until raise/call betting-closure fix is deployed and live-verified |
| Badugi raise/call betting closure | FIXED_LOCAL / NEEDS_LIVE_VERIFY; local action-history audit confirms Hero does not receive a second same-round action after all callers match |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| D01 2-7TD active status | PASS |
| Core 5 actor order | PASS, per-action history audit |
| Core 5 orientation support | PASS |
| Core 5 mobile tournament portrait/landscape | FAIL on live URL for D01/D02/S01/S02 due browser fatal `applyPlayerAction is not a function` |
| Live Core5 cash mobile evidence | PASS for Badugi/D01/D02/S01/S02 at 390x844 and 430x932 |
| Live Core5 action order | PASS, 63 audited betting actions, 0 invalid actor rows |
| Core5 Cash lifecycle invariant gate | PASS locally, 6,000 synthetic hands / 60 sessions / 0 violations; 5/5 full browser lifecycle variants; 25/25 individual Cash checks |
| Core5 Tournament lifecycle invariant gate | PASS locally, 1,200 synthetic tournaments / 0 violations; 5/5 full browser lifecycle variants; 30/30 individual Tournament checks |
| Tournament integration expansion | PASS locally, 90-row sweep / 0 violations; unit integration 28/28; tournament E2E integration 50/50 |
| Physical mobile QA | PENDING, no physical device available in this environment |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | `BADUGI-BET-REOPEN-001` pending live verification; `CORE5-UI-LIVE-001` D01/D02/S01/S02 tournament runtime fatal on live |
| Badugi friend-alpha exposure | HOLD until local betting-closure fix is deployed and live action-history evidence passes |

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

Deploy the Badugi betting-closure fix, verify `window.__MGX_BUILD_INFO__` and bundle path on `https://mgx-poker.com/`, rerun Badugi raise/call closure history on live, fix the live D01/D02/S01/S02 tournament fatal, rerun live layout evidence, run physical mobile QA on at least Android Chrome or iPhone Safari/Chrome, and push `feature/d-04-next-actor-unify` from a credentialed environment. Only then can the Core5 friend alpha move from HOLD to GO.

Badugi should be watched closely in alpha: Step6 clears the Badugi portrait mobile UI blocker, Step7 clears the automated long-run active-pot / terminal-transition blocker, and the new raise/call closure regression proves locally that a raiser is not reselected after all remaining players call/fold. This latest Badugi fix must be live-verified before Badugi can be exposed to friend testers.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.

The latest live Core5 betting-order reality audit records expected-vs-actual samples for Badugi/D01/D02/S01/S02. It found no invalid actor rows and no hero-control mismatch rows. The reported BB case is treated as `FALSE_ALARM_CONFIRMED_BY_HISTORY`, not a P0, because live action history shows actors match canonical order.
