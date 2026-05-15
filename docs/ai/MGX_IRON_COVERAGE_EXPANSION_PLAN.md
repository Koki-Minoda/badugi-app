# MGX Iron Coverage Expansion Plan

## Step27 Decision

Step27 does not approve direct dataset expansion. The strongest non-weak/non-trash signal is `S02 lowerMediumSDA5 bet-pressure`, but it has only `17` samples and therefore needs focused counterfactual replay before any dataset proposal.

## Candidate Ranking

| Priority | Variant | Bucket Family | Evidence | Risk | Next Action |
| --- | --- | --- | --- | --- | --- |
| P2_COUNTERFACTUAL_FIRST | S02 | lowerMediumSDA5 bet-pressure | freq `17`, Standard advantage `35.2941`, Pro fallback `0.9953`, Iron-Pro gap `1.4625` | medium: low sample / low confidence | Run focused counterfactual replay before dataset expansion. |
| DO_NOT_TOUCH | S01 | lowerMediumSD27 bet-pressure | freq `57`, meanDelta `32.4561`, signFlipRate `0.4615` | high: sign flip instability | Do not expand; optionally re-check with counterfactual-only audit. |
| DO_NOT_TOUCH | S02 | weakSDA5 bet-pressure | freq `87`, meanDelta `47.0082`, signFlipRate `0.3571` | high: weak broad bucket | Monitor only. |
| DO_NOT_TOUCH | S01 | weakSD27 bet-pressure | freq `186`, meanDelta `26.4875`, signFlipRate `0.4000` | high: weak broad bucket / sign flip | Monitor only. |
| DO_NOT_TOUCH | D02 | trashA5 FOLD/CALL verify | freq `1208`, meanDelta `6.7345`, signFlipRate `0.4667` | high: trash broad bucket / sign flip | Monitor only. |
| DO_NOT_TOUCH | S01 | trashSD27 FOLD/CALL verify | freq `1419`, meanDelta `4.2426`, signFlipRate `0.4444` | high: trash broad bucket / sign flip | Monitor only. |
| DO_NOT_TOUCH | S02 | trashSDA5 FOLD/CALL verify | freq `1504`, meanDelta `4.3424` | high: trash broad bucket | Monitor only. |

## Missing Coverage By Variant

| Variant | DatasetHitRate | ProFallbackRate | Missing Family |
| --- | ---: | ---: | --- |
| D02 | `0.0026` | `0.9973` | premiumA5 value spots; trashA5 FOLD/CALL verify; weakA5 bet-pressure/open-or-checkback/raise-pressure |
| S01 | `0.0039` | `0.9961` | lowerMediumSD27 bet/open/checkback/raise; premiumSD27 bet-pressure; trashSD27; upperMediumSD27; weakSD27 |
| S02 | `0.0046` | `0.9953` | lowerMediumSDA5 bet/open/checkback/raise; premiumSDA5; trashSDA5; weakSDA5 |

## Required Frozen State

| Item | Result |
| --- | --- |
| dataset rows unchanged | true |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| no gameplay mutation | true |
