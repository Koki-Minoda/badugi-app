# MGX Action-value Dataset Spec

Schema goal:
- replay-backed action-value supervision for draw-family Pro / Iron bootstrap
- fixed observation shape for draw variants
- legal action preservation and bucket traceability

## Row Schema

```json
{
  "variantId": "S02",
  "schemaVersion": 1,
  "observation": [],
  "legalActions": [],
  "candidateActions": [
    {
      "action": {},
      "source": "pro|standard|replay|counterfactual",
      "estimatedValue": 0,
      "sampleCount": 0,
      "confidence": 0,
      "verdict": "GOOD|BAD|NOISY"
    }
  ],
  "chosenBestAction": {},
  "handClass": "strongSDA5",
  "bucket": "strongSDA5-safe-pressure",
  "metadata": {}
}
```

## Required Fields

| Field | Requirement |
| ----- | ----------- |
| `schemaVersion` | integer, currently `1` |
| `variantId` | one of draw-family replay-supported variants |
| `observation` | length `96`, finite numeric values |
| `legalActions` | preserved legal action list from replay sample |
| `candidateActions` | replay-backed action/value rows |
| `chosenBestAction` | legal action selected from candidate values |
| `bucket` | replay/counterfactual bucket label |
| `confidence` | stored per candidate action |
| `source` | `pro`, `standard`, `replay`, or `counterfactual` |
| `metadata` | seed/hand/step/context and safety provenance |

## Filtering Rules

- include valid replay rows only
- exclude illegal replay actions
- require EV checker pass
- exclude `NOISY` buckets from training rows
- weak/trash buckets are excluded by default for bootstrap supervision
- keep bucket/source/confidence so training can down-weight or skip rows later

## Safety

- `safetyVerdict` must remain `PASS`
- rows with invalid or missing legal action alignment are rejected by the validator
- duplicate replay rows are rejected during validation
