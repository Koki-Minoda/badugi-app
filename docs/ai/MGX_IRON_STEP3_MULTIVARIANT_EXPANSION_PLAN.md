# MGX Iron Step3 Multi-Variant Expansion Plan

| Variant | Current Rows | Target | Priority |
| ------- | -----------: | -----: | -------- |
| D02 | 87 | 150+ | maintain |
| S01 | 0 | 50+ | high |
| S02 | 0 | 50+ | high |
| D01 | 0 | 50+ | medium |

## Collection Rules

- Stable bucket only for positive training rows.
- Noisy bucket excluded from positive supervision.
- Weak/trash guard buckets remain negative-only or excluded.
- Confidence, sampleCount, replay consistency, and rarity are preserved for weighting.

## Variant Notes

- `D02`: maintain `strongA5 second-pressure` coverage and remove the remaining replay legality mismatch.
- `S01`: focus on `strongSD27 top-end pressure`; current fresh evidence is still `NEEDS_MORE_SAMPLES`.
- `S02`: focus on sparse good-hand pressure/value spots only; do not reopen weak/trash guard buckets.
- `D01`: start with post-Step4O/Step4P strong pat pressure spots before expanding into broader draw-round buckets.

## Training Gate Intent

- `okForSupervisedTraining` can stay true with single-variant sparse data.
- `okForIronCandidate` remains blocked until at least two variants have stable, deterministic, training-allowed rows.
