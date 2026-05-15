# MGX Iron Step3 Invalid Replay Audit

## Summary

| Item | Result |
| ---- | ------ |
| Invalid replay count | `1` |
| Variant | `D02` |
| Bucket | `strongA5 second-pressure` |
| Replayed action | `RAISE` |
| Source policy | `pro` |
| Root cause | `Fixed-limit raise cap reached` |
| Step3 classification | `LEGAL_ACTION_MISMATCH` |

## Notes

- The single invalid replay came from a `D02 strongA5 second-pressure` sample where the saved `legalActions` still exposed `RAISE`, but the restored replay path hit the fixed-limit raise cap.
- This is not a weak/trash guard regression.
- The replay sidecar is stored in `reports/ai-eval/invalid-replay-step3.json`.
- The current counterfactual JSON still carries the historical `INVALID_REPLAY` bucket row; Step3 interprets that row as a `LEGAL_ACTION_MISMATCH` caused by restore-time raise-cap divergence.

## Action

- Keep the sample excluded from training.
- Require determinism + legal-action parity before using this bucket for Iron candidate gating.
