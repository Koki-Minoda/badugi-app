# MGX Iron Step6 D01 Stable Bucket Discovery

Step6 increases `D01` sampling pressure with `iron-step6` D01-focused quotas while keeping existing stable buckets from `D02`, `S01`, and `S02`.

## D01 Bucket Results

| Bucket | Samples | Confidence | Verdict | DatasetEligible |
| ------ | ------: | ---------: | ------- | --------------- |
| premium27TD late pressure | 3 | 0.0113 | NEEDS_MORE_SAMPLES | NO |
| strong27TD late pressure | 1294 | 1.0000 | NOISY | NO |
| medium27TD pressure | 473 | 1.0000 | NOISY | NO |

## Notes

- `premium27TD late pressure` remains too sparse despite Step6 D01-focused quotas.
- `strong27TD late pressure` has large sample volume but still fails sign stability, so it cannot be promoted into the stable dataset.
- `medium27TD pressure` also remains noisy and is excluded from export.
- Step6 therefore does **not** add a `D01` stable bucket.
