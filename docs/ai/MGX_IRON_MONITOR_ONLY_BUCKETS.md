# MGX Iron Monitor-Only Buckets

## Scope

This document tracks coverage candidates that produced useful counterfactual evidence but are not safe dataset export targets. Step30 does not add dataset rows, change routing, promote Iron, mutate gameplay, or change source priority.

## Buckets

| Candidate | Classification | Monitor Only | Export Status | Evidence | Reopen Criteria |
| --- | --- | --- | --- | --- | --- |
| S02 lowerMediumSDA5 bet-pressure | COUNTERFACTUAL_ONLY | true | DO_NOT_EXPORT | Step29 forced replay meanDelta `24.0000`, signFlipRate `0.4333`, confidence `0.4250`, invalidReplayCount `0`, repairRate `0.0000`; entropy not isolated. | signFlipRate `<= 0.10`, confidence `>= 0.80`, invalidReplayCount `0`, repairRate `<= 0.10`, isolated entropy, and stable positive forced-action EV. |

## Governance

| Item | Result |
| --- | --- |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplayMutation | false |
| sourcePriorityChanged | false |
