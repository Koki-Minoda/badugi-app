# MGX Iron Do Not Touch Buckets

## Scope

This document records bucket families that must not be expanded during the Iron coverage audit unless a later step explicitly changes the governance plan with new counterfactual evidence.

Step27 does not add dataset rows, change routing, promote Iron, mutate gameplay, add D01 teacher data, or change source priority.

## Do Not Touch Rules

| Bucket / Condition | Reason | Step27 Handling |
| --- | --- | --- |
| D01 teacher dataset | D01 remains excluded from Iron bootstrap expansion. | Do not add, replay, or route. |
| weak/trash broad bucket | High frequency but noisy; broad corrections can overfit bad continuation behavior. | Monitor only unless a later counterfactual step proves a narrow legal subbucket. |
| high signFlipRate bucket | Direction is unstable across observed action differences. | Do not expand. |
| high repairRate bucket | Repair-heavy buckets are not clean supervision targets. | Do not expand. |
| gameplay mutation required bucket | Step27 is coverage audit only. | Exclude. |
| noisy bucket | Low confidence or inconsistent EV signal. | Counterfactual first or monitor only. |
| source priority override bucket | Source priority is frozen. | Exclude. |

## Step27 Observed Buckets

| Variant | Bucket Family | Evidence | Decision |
| --- | --- | --- | --- |
| D02 | trashA5 FOLD/CALL verify | freq `1208`, meanDelta `6.7345`, signFlipRate `0.4667` | DO_NOT_TOUCH |
| S01 | trashSD27 FOLD/CALL verify | freq `1419`, meanDelta `4.2426`, signFlipRate `0.4444` | DO_NOT_TOUCH |
| S02 | trashSDA5 FOLD/CALL verify | freq `1504`, meanDelta `4.3424`, broad trash bucket | DO_NOT_TOUCH |
| S01 | weakSD27 bet-pressure | freq `186`, meanDelta `26.4875`, weak bucket, signFlipRate `0.4000` | DO_NOT_TOUCH |
| S02 | weakSDA5 bet-pressure | freq `87`, meanDelta `47.0082`, weak bucket, signFlipRate `0.3571` | DO_NOT_TOUCH |
| S01 | lowerMediumSD27 bet-pressure | freq `57`, meanDelta `32.4561`, signFlipRate `0.4615` | DO_NOT_TOUCH for expansion; counterfactual evidence may be gathered later |
| D02 | weakA5 bet-pressure | freq `26`, meanDelta `19.2308`, weak bucket | DO_NOT_TOUCH |

## Monitor-Only Exceptions

These buckets are not hard Do Not Touch entries, but they must not be exported until later forced replay evidence satisfies the listed reopen criteria.

| Variant | Bucket Family | Classification | Reopen Criteria |
| --- | --- | --- | --- |
| S02 | lowerMediumSDA5 bet-pressure | COUNTERFACTUAL_ONLY / MONITOR_ONLY / DO_NOT_EXPORT | Do not export until signFlipRate `<= 0.10`, confidence `>= 0.80`, invalidReplayCount `0`, repairRate `<= 0.10`, and entropy is isolated to a clean sub-bucket. |

## Governance State

| Item | Result |
| --- | --- |
| dataset rows unchanged | true |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| no gameplay mutation | true |
