# MGX Iron Step7 Entropy Report

## Summary

Entropy analysis was run against the D01-only isolated replay corpus from `iron-step7`.

Goals:

- reduce sign-flip noise inside the broad D01 late-pressure buckets
- surface low-entropy, high-confidence sub-buckets
- determine whether any D01 sub-bucket can safely enter the supervised dataset

## Low-Entropy Candidates

| Sub-bucket | Samples | Mean Delta | Sign Flip Rate | Confidence | Entropy | Interpretation |
| ---------- | ------: | ---------: | -------------: | ---------: | ------: | -------------- |
| `strong27TD late pressure|3way|blind|medium|repeatedPressure|finalRound|rough` | 70 | 51.43 | 0.0000 | 1.0000 | 0.0000 | stable, but `PRO_BETTER` |
| `strong27TD late pressure|4way+|IP|medium|repeatedPressure|finalRound|rough` | 48 | 0.00 | 0.1458 | 1.0000 | 0.0000 | low entropy, but no clear edge |

## Remaining High-Entropy / Sign-Flip Sub-buckets

| Sub-bucket | Samples | Mean Delta | Sign Flip Rate | Confidence | Result |
| ---------- | ------: | ---------: | -------------: | ---------: | ------ |
| `strong27TD late pressure|3way|IP|medium|repeatedPressure|finalRound|rough` | 240 | -77.79 | 0.4000 | 1.0000 | noisy |
| `strong27TD late pressure|3way|button|medium|repeatedPressure|finalRound|rough` | 221 | -104.23 | 0.4932 | 1.0000 | noisy |
| `strong27TD late pressure|3way|OOP|medium|repeatedPressure|finalRound|rough` | 167 | -70.72 | 0.4072 | 1.0000 | noisy |
| `strong27TD late pressure|4way+|blind|medium|repeatedPressure|finalRound|rough` | 50 | -28.00 | 0.3000 | 0.7690 | noisy |

## Conclusion

- entropy reduction worked well enough to isolate coherent D01 sub-buckets
- the isolated sub-buckets did **not** yield a dataset-safe `STABLE_STANDARD_BETTER` candidate
- D01 remains the only missing variant for the `minimumVariants = 4` gate
