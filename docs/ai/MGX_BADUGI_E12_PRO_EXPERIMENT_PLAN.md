# MGX Badugi E12 Pro experiment plan

## Decision

E11 remains the production Standard model. It is the only allowed parent for
E12. The old Standard remains Beginner. No E12 checkpoint may replace either
model until it passes the confirmation evaluation below.

The independent E11 evaluation completed 10,500 episodes with ONNX usage 100%
and fallback 0%. E11 improved average reward and value betting, but its
loose-aggressive reward (0.298439) missed the 0.301 guard by 0.002561 and the
0.35 Pro threshold by a wider margin. Extending the same training branch is
therefore forbidden.

## Serial experiment matrix

Windows is memory constrained, so exactly one CPU trainer may run at a time.
Every probe starts from the immutable E11 3k checkpoint (SHA-256
`5b44a23972d98a7d4e86c0a742b80b37f70297cff2ac2683683a9f57d065d1ef`).

| ID | Episodes | LA mix | Fixed E11 opponent | Learning rate | Purpose |
|---|---:|---:|---|---:|---|
| E12-LA | 3,000 | 0.75 | No | 0.00003 | Increase direct loose-aggressive exposure |
| E12-ANCHOR | 3,000 | 0.50 | Yes | 0.00003 | Prevent policy cycling while retaining diversity |
| E12-LOWLR | 3,000 | 0.50 | No | 0.00001 | Test whether smaller updates preserve E11 value betting |

All branches use seed `20260903`, resume epsilon `0.08`, opponent epsilon
`0.03`, and the profiles `loose_aggressive,draw_heavy,tight_aggressive`.
The anchor branch sets the opponent update interval above the experiment length
so the E11 opponent cannot be overwritten.

## Gates

Screen every 1,000-episode checkpoint with the same paired seeds and seven
profiles used for E11. A branch stops immediately when any checkpoint has:

- average reward delta below -0.02 versus E11;
- loose-aggressive reward below 0.301;
- value-bet rate below E11 by more than 0.05;
- ONNX usage below 100% or fallback above 0%;
- corrupt/missing checkpoint, manifest, evaluation, or SHA-256 evidence.

Rank surviving 3k probes by loose-aggressive reward, then worst-profile reward,
then average reward, then value-bet retention. Only the winner advances to a
fresh 10k confirmation branch from E11. Pro promotion requires all of:

- average reward >= 0.705405 (E11 + 0.05);
- worst-profile and loose-aggressive reward >= 0.35;
- value-bet rate >= 0.789954 (E11 - 0.05);
- ONNX usage 100%, fallback 0%;
- two consecutive confirmation checkpoints passing on three fixed seeds plus
  one unseen-seed evaluation.

## Operational hold

The launcher defaults to `Plan`; it does not start training. `Run` remains
operator-controlled and must not be used until the product tasks and Windows
artifact relocation are complete. Promotion, Git merge, and deployment are
separate manual decisions.
