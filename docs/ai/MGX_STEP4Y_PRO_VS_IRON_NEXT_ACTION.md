# MGX Step4-Y Pro vs Iron Next Action

| Bucket | Classification | Reason | Next |
| ------ | -------------- | ------ | ---- |
| D01 `medium27TD pressure` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D01 `premium27TD late pressure` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D01 `strong27TD late pressure` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D02 `mediumA5 small-pressure` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D02 `premiumA5 value spots` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D02 `strongA5 second-pressure` | Pro heuristicで触る | high confidence replay-backed bucket | 極小 rule patch 候補 |
| D02 `trashA5 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
| S01 `strongSD27 top-end pressure` | Pro heuristicで触る | high confidence replay-backed bucket | 極小 rule patch 候補 |
| S01 `trashSD27 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
| S01 `upperMediumSD27 small-pressure` | Pro heuristicで触る | high confidence replay-backed bucket | 極小 rule patch 候補 |
| S02 `premiumSDA5 CALL/RAISE` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| S02 `strongSDA5 CALL/FOLD/RAISE` | Pro heuristicで触る | high confidence replay-backed bucket | 極小 rule patch 候補 |
| S02 `trashSDA5 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
