# MGX Iron Bootstrap Step1 Report

| Item | Result |
| ---- | ------ |
| Dataset rows | `40` |
| Valid rows | `40` |
| Invalid rows | `0` |
| Training allowed | `true` |
| Variant coverage | `D02:40` |
| Sparse warnings | `sparse-dataset, low-variant-coverage, single-variant-bias, d02-heavy-bias` |
| Candidate metadata generated | `YES` |
| Promoted | NO |

## Notes

- Dataset source: `/home/mgx/badugi-app/data/ai/action-value/step4y-action-value.jsonl`
- Remaining limitation: replay-derived supervision is sparse and D02-heavy.
- Next RL phase: use the candidate metadata as the gate into Iron Bootstrap Step2 supervised training hooks.
- Next dataset expansion targets: `S01 strongSD27`, `S02 strongSDA5`, and broader fresh counterfactual coverage.
- Bias warning: the current export is dominated by D02 buckets and should not mutate production routing.
