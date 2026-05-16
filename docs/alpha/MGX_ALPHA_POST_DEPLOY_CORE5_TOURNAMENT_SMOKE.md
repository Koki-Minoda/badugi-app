# MGX Alpha Post-Deploy Core5 Tournament Smoke

Date: 2026-05-16T13:41:22Z

URL: `https://mgx-poker.com/`

Deployed commit: `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`

## Result

Post-deploy Core5 tournament smoke: PASS

Report artifact: `reports/alpha/post-deploy-core5-tournament-smoke.json`

## Checks

| Check | Result |
| --- | --- |
| MainMenu loads at 390x844 | PASS |
| MainMenu loads at 844x390 | PASS |
| D01 / 2-7 Triple Draw launch | PASS |
| D02 / A-5 Triple Draw launch | PASS |
| S01 / 2-7 Single Draw launch | PASS |
| S02 / A-5 Single Draw launch | PASS |
| Tournament mode portrait | PASS |
| Tournament mode landscape | PASS |
| compact tournament HUD | PASS |
| table visible | PASS |
| pot visible | PASS |
| action controls container visible | PASS |
| no horizontal overflow | PASS |
| Badugi without preview flag | PASS, disabled / preview-only |

## Layout Metrics Summary

| Viewport | HUD | Table | Overflow | Result |
| --- | --- | --- | ---: | --- |
| 390x844 portrait | compact, 107.5px high | visible, 518.5px high | 0 | PASS |
| 844x390 landscape | compact side panel, 244.75px wide | visible, 575.25px wide | 0 | PASS |

## Notes

This smoke is browser automation against the deployed preview URL. It does not replace physical mobile QA on Android Chrome or iPhone Safari/Chrome.
