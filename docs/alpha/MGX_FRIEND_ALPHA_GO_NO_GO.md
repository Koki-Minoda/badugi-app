# MGX Friend Alpha GO / NO-GO

Date: 2026-05-16

## Decision

`HOLD_FOR_PHYSICAL_MOBILE_QA_AND_REMOTE_SYNC`

The latest preview deploy includes the Core 5 mobile tournament layout fix at `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`. Badugi is now intentionally included in the friend-alpha scope because it is a core MGX game and its automated progression, pot, terminal, portrait/mobile, orientation, and actor-order gates pass. Friend alpha should remain held until this Badugi availability change is deployed, real-device mobile QA is completed, and the ahead local branch is pushed from a credentialed environment.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | BLOCKED, branch ahead 38 before this docs update |
| Latest preview deploy | PENDING for Badugi promotion; current deployed preview is `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |
| Badugi alpha availability | INTENDED, pending deploy |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| D01 2-7TD active status | PASS |
| Core 5 actor order | PASS, per-action history audit |
| Core 5 orientation support | PASS |
| Core 5 mobile tournament portrait/landscape | PASS in automation |
| Post-deploy browser smoke | PASS, Core5 tournament portrait/landscape live preview smoke |
| Physical mobile QA | PENDING, no physical device available in this environment |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | none observed |
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

Deploy the Badugi availability change, run physical mobile QA on at least Android Chrome or iPhone Safari/Chrome, and push `feature/d-04-next-actor-unify` from a credentialed environment. If the device pass is clean and remote sync is resolved or explicitly accepted as a P1 operational risk, the Core5 friend alpha can move from HOLD to GO.

Badugi should be watched closely in alpha: Step6 clears the Badugi portrait mobile UI blocker, Step7 clears the automated long-run active-pot / terminal-transition blocker, and the Core 5 UI audit now has no desktop, cash mobile, tournament mobile, or interaction UI blocker in automation.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.

The latest Core 5 betting-order reality audit records every observed betting action for Badugi/D01/D02/S01/S02. It found no invalid actor rows and no hero-control mismatch rows. The reported BB case is treated as `FALSE_ALARM_CONFIRMED_BY_HISTORY`, not a P0, because history shows BB acts only after prior active obligations or when BB is the first active seat left of the button after folds.
