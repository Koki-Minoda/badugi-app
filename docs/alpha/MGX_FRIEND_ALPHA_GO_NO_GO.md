# MGX Friend Alpha GO / NO-GO

Date: 2026-05-16

## Decision

`HOLD_FOR_LIVE_TOURNAMENT_RUNTIME`

The live URL is the release source of truth for this gate. `https://mgx-poker.com/` is healthy, but its frontend build info reports deployed commit `f2c36e7ec833153b8428da07918bf7c8fb3ee234`, not local HEAD `e8d94f9d0e49d61713db41025d81d9a3ccd601e8`. More importantly, live evidence shows D01/D02/S01/S02 tournament mode fails with browser fatal `applyPlayerAction is not a function` across portrait and landscape mobile viewports. Friend alpha remains HOLD.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | BLOCKED / unresolved |
| Live deploy snapshot | FAIL, live `f2c36e7` != local `e8d94f9` |
| Badugi alpha availability | Live launch evidence collected; Badugi cash/tournament geometry passes in this live audit |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| D01 2-7TD active status | PASS |
| Core 5 actor order | PASS, per-action history audit |
| Core 5 orientation support | PASS |
| Core 5 mobile tournament portrait/landscape | FAIL on live URL for D01/D02/S01/S02 due browser fatal `applyPlayerAction is not a function` |
| Live Core5 cash mobile evidence | PASS for Badugi/D01/D02/S01/S02 at 390x844 and 430x932 |
| Live Core5 action order | PASS, 63 audited betting actions, 0 invalid actor rows |
| Physical mobile QA | PENDING, no physical device available in this environment |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | `CORE5-UI-LIVE-001`: D01/D02/S01/S02 tournament runtime fatal on live |
| Badugi friend-alpha exposure | included in Core5 alpha scope; monitor closely during physical mobile QA |

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

Fix the live D01/D02/S01/S02 tournament fatal, deploy the intended head, verify `window.__MGX_BUILD_INFO__` and bundle path on `https://mgx-poker.com/`, rerun live layout evidence, run physical mobile QA on at least Android Chrome or iPhone Safari/Chrome, and push `feature/d-04-next-actor-unify` from a credentialed environment. Only then can the Core5 friend alpha move from HOLD to GO.

Badugi should be watched closely in alpha: Step6 clears the Badugi portrait mobile UI blocker, Step7 clears the automated long-run active-pot / terminal-transition blocker, and the Core 5 UI audit now has no desktop, cash mobile, tournament mobile, or interaction UI blocker in automation.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.

The latest live Core5 betting-order reality audit records expected-vs-actual samples for Badugi/D01/D02/S01/S02. It found no invalid actor rows and no hero-control mismatch rows. The reported BB case is treated as `FALSE_ALARM_CONFIRMED_BY_HISTORY`, not a P0, because live action history shows actors match canonical order.
