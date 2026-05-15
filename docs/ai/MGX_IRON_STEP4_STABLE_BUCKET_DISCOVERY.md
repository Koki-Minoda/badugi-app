# MGX Iron Step4 Stable Bucket Discovery

Corpus tag: `iron-step4`

## Stable Buckets

| Variant | Bucket | Samples | Verdict | Confidence | Include |
| ------- | ------ | ------: | ------- | ---------: | ------- |
| D02 | `strongA5 second-pressure` (`FOLD -> RAISE`) | 62 | `STABLE_STANDARD_BETTER` | 1.0000 | YES |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`FOLD -> RAISE`) | 36 | `STABLE_STANDARD_BETTER` | 0.9374 | YES |

## Not Yet Stable

| Variant | Bucket | Samples | Verdict | Confidence | Include |
| ------- | ------ | ------: | ------- | ---------: | ------- |
| S01 | `strongSD27 top-end pressure` | 23 | `NEEDS_MORE_SAMPLES` | 0.6391 | NO |
| D01 | `premium27TD late pressure` | 1 | `NEEDS_MORE_SAMPLES` | 0.0333 | NO |
| D01 | `strong27TD late pressure` | 107 | `NOISY` | 0.9275 | NO |
| D01 | `medium27TD pressure` | 125 | `NOISY` | 1.0000 | NO |
| D02 | `mediumA5 small-pressure` | 3 | `NEEDS_MORE_SAMPLES` | 0.0444 | NO |
| D02 | `premiumA5 value spots` | 9 | `NOISY` | 0.0113 | NO |
| S01 | `upperMediumSD27 small-pressure` | 3 | `NEEDS_MORE_SAMPLES` | 0.0444 | NO |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`FOLD -> CALL`) | 7 | `NOISY` | 0.1191 | NO |
| S02 | `premiumSDA5 CALL/RAISE` | 9 | `NOISY` | 0.0000 | NO |

## Excluded Noisy Buckets

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| D01 | `strong27TD late pressure` | Sign unstable across seeds despite sample volume. |
| D01 | `medium27TD pressure` | Stable mean not supported; replay consistency below stable gate. |
| D01 | `trash27TD FOLD/CALL verify` | Trash/weak verify bucket; intentionally excluded. |
| D02 | `trashA5 FOLD/CALL verify` | Trash verify bucket; intentionally excluded. |
| S01 | `trashSD27 FOLD/CALL verify` | Trash verify bucket; intentionally excluded. |
| S02 | `trashSDA5 FOLD/CALL verify` | Trash verify bucket; intentionally excluded. |
| S02 | `premiumSDA5 CALL/RAISE` | Sparse and no clear edge. |

## Discovery Summary

- `D02-only` is no longer true for the exported Step4 dataset.
- `S02` now contributes a stable replay-backed strong-hand bucket.
- `S01` and `D01` still fail the stable-bucket gate for positive training rows.
- Multi-variant expansion improved dataset usefulness for supervised bootstrap, but not enough for `iron-candidate` quality promotion.
