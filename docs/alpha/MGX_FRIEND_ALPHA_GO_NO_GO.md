# MGX Friend Alpha GO / NO-GO

Date: 2026-05-16

## Decision

`HOLD_FOR_PHYSICAL_MOBILE_QA`

The latest mobile overflow fix is deployed and the alpha scope has no known deployed P0. Friend alpha should remain held until real-device mobile QA is completed.

## Gate Summary

| Gate | Result |
| --- | --- |
| Remote source sync for deployed commit | PASS |
| Latest preview deploy | PASS |
| D02/S01/S02 desktop smoke | PASS |
| D02/S01/S02 mobile emulation | PASS |
| D02/S01/S02 Triple Draw actor / mapping audit | PASS |
| Post-deploy browser smoke | PASS |
| Physical mobile QA | PENDING |
| Core 5 UI layout | PASS for all five core games in automation |
| Alpha-scope P0 | none observed |
| Badugi friend-alpha exposure | blocked; remains `preview_only` after alpha restore gates found a long-run active-pot/terminal-transition blocker |

## Alpha Scope

| Variant | Status |
| --- | --- |
| D02 | alpha candidate |
| S01 | alpha candidate |
| S02 | alpha candidate |
| Badugi | preview-only; portrait UI gate now passes, restore still blocked by long-run active-pot/terminal mismatch |
| Chinese/OFC | coming soon |
| Board/Omaha/Stud/Razz/Dramaha families | preview-only or unavailable for friend alpha |

## Remaining Required Action

Run physical mobile QA on at least Android Chrome or iPhone Safari/Chrome. If the device pass is clean, the D02/S01/S02-only friend alpha can move from HOLD to GO.

Badugi has a separate restore gate and must remain out of the friend alpha until its long-run readiness blocker is fixed. Step6 clears the Badugi portrait mobile UI blocker; the Core 5 UI audit now has no desktop, portrait, landscape, or interaction UI blocker in automation.

Triple Draw / Single Draw mapping has been re-audited: `D02` is A-5 Triple Draw, `S01` is 2-7 Single Draw, and `S02` is A-5 Single Draw. The suspected six-max BB-first issue was not reproduced in the engine; heads-up blind/button semantics were corrected and covered.
