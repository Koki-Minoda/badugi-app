# MGX Alpha Physical Mobile QA Result

Date: 2026-05-16

## Decision

`FAIL_P0_BADUGI_WAITING_FREEZE`

Physical mobile QA found a live Badugi tournament P0 on iPhone: hand 5/5 can stay on `Waiting for other players...` at BET Draw2 / Bet Round 2 with To Call 0 and Pot 66. Friend alpha remains `HOLD` until this is fixed, deployed, and rechecked on a real device.

The same physical QA pass also flagged D01 blind display risk: Hero appeared labeled `BB` with `BET 0`, Pot 30, and To Call 20. Local audit classifies this as a likely position badge/display mismatch, not confirmed blind non-payment: D01 engine and current UI/browser trace post and display SB/BB correctly after the dealer-index fix.

## P0 Findings

| ID | Status | Evidence | Required Follow-up |
| --- | --- | --- | --- |
| `PHYSICAL-MOBILE-BADUGI-WAITING-001` | OPEN | iPhone live preview screenshot | Export freeze report with `?mgxQa=mobile`, fix waiting/round-closure path, deploy, physical recheck. |
| `BADUGI-DRAW-BET-MIX-001` | OPEN | second physical screenshot | Separate focused DRAW/BET divergence regression after waiting freeze. |
| `D01-BLIND-POSTING-001` | FIXED_LOCAL / NEEDS_PHYSICAL_RECHECK | iPhone live preview screenshot; local blind trace | Deploy, export `?mgxQa=mobile` blindPosting JSON on device, and verify BB seat shows posted BB amount. |

## Required Device Checks

| Device / Browser | Status |
| --- | --- |
| Android Chrome | PENDING |
| iPhone Safari | PENDING |
| iPhone Chrome | Optional / PENDING |

## Checklist

| Check | Result |
| --- | --- |
| Initial load | PENDING |
| D02 launch | PENDING |
| S01 launch | PENDING |
| S02 launch | PENDING |
| Action buttons visible/tappable | PENDING |
| No horizontal overflow | PENDING |
| Pot visible | PENDING |
| Phase visible | PENDING |
| Result overlay usable | PENDING |
| Next hand works | PENDING |
| Learning Dashboard graph readable | PENDING |
| Replay queue usable | PENDING |

## Current Automated Support

D02/S01/S02 pass mobile emulation at 390x844, 430x932, and 844x390, including result-overlay reachability on 390x844. This does not replace real-device touch/orientation QA.
