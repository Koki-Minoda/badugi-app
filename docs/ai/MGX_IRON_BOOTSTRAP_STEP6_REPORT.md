# MGX Iron Bootstrap Step6 Report

Step6 focuses on `D01` stable bucket discovery while preserving the existing multi-variant Iron bootstrap dataset from `D02`, `S01`, and `S02`.

## Summary

| Item | Result |
| ---- | ------ |
| Corpus tag | iron-step6 |
| Dataset rows | 649 |
| Stable variants | 3 (`D02`, `S01`, `S02`) |
| D01 stable buckets | 0 |
| invalidReplayCount | 0 |
| deterministicReplay | true |
| minimumVariants | 3 |
| maxSingleVariantShare | 0.4037 |
| okForIronCandidate | false |
| eligibleForOfflineArena | false |
| eligibleForPromotion | false |
| routingChanged | false |

## Stable Bucket Summary

| Variant | Bucket | Rows | Confidence |
| ------- | ------ | ---: | ---------: |
| D02 | strongA5 second-pressure | 157 | 1.0000 |
| S01 | strongSD27 top-end pressure | 219 | 1.0000 |
| S01 | upperMediumSD27 small-pressure | 43 | 1.0000 |
| S02 | strongSDA5 CALL/FOLD/RAISE | 230 | 1.0000 |

## D01 Bucket Results

| Bucket | Samples | Confidence | Verdict | DatasetEligible |
| ------ | ------: | ---------: | ------- | --------------- |
| premium27TD late pressure | 3 | 0.0113 | NEEDS_MORE_SAMPLES | NO |
| strong27TD late pressure | 1294 | 1.0000 | NOISY | NO |
| medium27TD pressure | 473 | 1.0000 | NOISY | NO |

## Dataset Rebalance Summary

| Variant | Raw Share | Rebalanced Share |
| ------- | --------: | ---------------: |
| D02 | 0.2419 | 0.4037 |
| S01 | 0.4037 | 0.3403 |
| S02 | 0.3544 | 0.2560 |

## Outcome

- Replay determinism remains stable with `mismatchCount=0`.
- Counterfactual replay runs with `invalidReplayCount=0`.
- Step6 improves `S01` coverage further but still fails the `minimumVariants >= 4` gate because no `D01` bucket reaches stable status.
- The only quality gate blocker is `insufficient-variant-coverage-for-iron-candidate`.
- Promotion, routing mutation, and live rollout remain disabled.
