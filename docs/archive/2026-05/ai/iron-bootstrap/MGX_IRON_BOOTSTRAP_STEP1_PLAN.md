# MGX Iron Bootstrap Step1 Plan

| Item | Decision |
| --- | --- |
| Bootstrap type | supervised warm start |
| Dataset | `data/ai/action-value/step4y-action-value.jsonl` |
| Source | Step4-Y counterfactual stable buckets |
| Initial coverage | D02-heavy |
| Tier target | `iron-candidate` |
| Auto promotion | NO |
| Require validation | YES |
| Sparse dataset warning | YES |
| Production routing mutation | FORBIDDEN |

## Constraints

- Dataset bias warning: current corpus is D02-heavy and does not represent balanced cross-variant Iron behavior.
- Noisy bucket limitation: S01/S02 buckets remain sparse or noisy and must not be promoted into rule patches automatically.
- Replay-derived supervision caveat: labels come from replay/counterfactual comparisons, not a solved game-theoretic oracle.
- Future RL integration plan: use the validated action-value rows as the supervised warm-start gate, then expand into Iron self-play / policy improvement only after broader dataset coverage is available.

## Explicit Non-goals

- No model promotion
- No `modelRegistry` mutation
- No tier escalation
- No production routing change
- No automatic replacement of live Pro / Standard behavior
