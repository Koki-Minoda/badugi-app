# MGX Iron Bootstrap Dataset Candidate

| Item | Result |
| ---- | ------ |
| Dataset | `data/ai/action-value/step4y-action-value.jsonl` |
| Rows | `71` |
| Valid | `71` |
| Invalid | `0` |
| TrainingAllowed | `true` |
| Main Variant | `D02` |
| Main Bucket | `strongA5 second-pressure` |
| Use | `supervised bootstrap / action-value warm start` |
| Risk | `sparse / D02-biased` |

## Classification

| Bucket | Classification | Note |
| ------ | -------------- | ---- |
| `D02 strongA5 second-pressure` | Pro heuristicに使ったbucket / Iron bootstrapに送るbucket | fresh corpus でも唯一 stable |
| `S01 strongSD27 top-end pressure` | Iron bootstrapに送るbucket | fresh corpusでは stable に届かない |
| `S02 premiumSDA5 CALL/RAISE` | Iron bootstrapに送るbucket | sparse / noisy |
| `S02 strongSDA5 CALL/FOLD/RAISE` | Iron bootstrapに送るbucket | sparse / noisy |
| weak/trash verify buckets | 触らない | guard risk が高い |
