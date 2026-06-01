# MGX Step4-Y Fresh vs Historical Corpus

Source artifacts:
- historical corpus tag: `step4w` (counterfactual score fallback: unlabeled/legacy report)
- fresh corpus tag: `step4w` (counterfactual score fallback used)
- compared variants: `D02,S01,S02`
- max counterfactual samples: `500`

## Corpus Summary

| Corpus | Tag | Samples | Valid Replays | Invalid Replays | Notes |
| ------ | --- | ------: | ------------: | --------------: | ----- |
| Historical | `step4w` | 112 | 8 | 0 | Step4-W baseline corpus |
| Fresh | `step4w` | 112 | 8 | 0 | Live post-patch Step4-X policy corpus |
| Postpatch tag presence | `step4x` | 0 | n/a | n/a | Dedicated Step4-X replay tag does not exist; fresh Step4-Y corpus is the current post-patch source of truth |

## Bucket Comparison

| Bucket | Historical Count | Fresh Count | Historical Delta | Fresh Delta | Status |
| ------ | ---------------: | ----------: | ---------------: | ----------: | ------ |
| D02 `strongA5 second-pressure` | 1 | 1 | -345 | -345 | `NOISY` |
| D02 `trashA5 FOLD/CALL verify` | 40 | 40 | n/a | n/a | `NOISY` |
| S01 `trashSD27 FOLD/CALL verify` | 33 | 33 | n/a | n/a | `NOISY` |
| S02 `trashSDA5 FOLD/CALL verify` | 38 | 38 | n/a | n/a | `NOISY` |

## Notes

- `DISAPPEARED` means the bucket no longer appears in the fresh tagged corpus at the filtered replay stage.
- `NOISY` means neither corpus yields a stable replay-backed edge after fresh rescoring.
- Dedicated `step4x` replay files are optional. When absent, Step4-Y fresh corpus is the authoritative post-patch comparison set.

