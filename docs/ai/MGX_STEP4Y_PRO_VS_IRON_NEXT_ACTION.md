# MGX Step4-Y Pro vs Iron Next Action

| Bucket | Classification | Reason | Next |
| ------ | -------------- | ------ | ---- |
| D02 `strongA5 second-pressure` | Iron datasetへ送る | sparse or state-dependent pattern; heuristic risk is higher than expected gain | action-value dataset candidate |
| D02 `trashA5 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
| S01 `trashSD27 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
| S02 `trashSDA5 FOLD/CALL verify` | 触らない | weak/trash guard risk or observationally noisy | Guard維持。dataset negative-only でも原則 reopen しない。 |
