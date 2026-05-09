# MGX Pro Step4-F D02 Strong A5 Defense

Source:
- `reports/ai-eval/pro-vs-standard-20260506-d02-300-step4f.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300-step4f.json`
- `reports/ai-eval/pro-vs-standard-20260508-d02-300-step4f.json`

Step4-F focus:
- keep `premiumA5` unchanged,
- let `strongA5` continue versus small bets,
- reduce repeated `medium/large` defense after pressure persists.

Observed `strongA5` call events in the Step4-F 300-hand runs: `6`

| Seed | Hand Class | Facing Bet Size | Street | Pro Action | Result EV | Suggested Rule |
| --- | --- | ---: | --- | --- | ---: | --- |
| `20260507` | `strongA5` | `large` | pre-draw (`drawRound=0`) | `CALL` | `-30` | Large pre-draw pressure on `strongA5` is still too loose. Fold more often when pot context is thin. |
| `20260507` | `strongA5` | `medium` | post-draw 1 (`drawRound=1`) | `CALL` | `-30` | Second-stage medium defense is still marginal. After one pressure event, `strongA5` should often stop bluff-catching. |
| `20260507` | `strongA5` | `large` | pre-draw (`drawRound=0`) | `CALL` | `-40` | Same leak pattern as above. Smooth `7-low` still over-defends some open pressure. |
| `20260507` | `strongA5` | `medium` | post-draw 1 (`drawRound=1`) | `CALL` | `-40` | Repeated medium pressure remains the main surviving D02 call leak. |
| `20260508` | `strongA5` | `large` | pre-draw (`drawRound=0`) | `CALL` | `+190` | Not every large-bet continue is bad. Some open-pressure defense still realizes value. |
| `20260508` | `strongA5` | `large` | pre-draw (`drawRound=0`) | `CALL` | `-20` | This is the remaining variance-sensitive edge. The rule should narrow, not eliminate, first-street `strongA5` defense. |

## Readout

- Step4-F reduced `strongA5` call volume to a very small bucket.
- The remaining losses are concentrated in `20260507` on the same pattern:
  `large` pre-draw call followed by `medium` post-draw call.
- This means the next D02 adjustment should not touch `premiumA5`.
- The next D02 adjustment should probably be:
  fold more often when `strongA5` faces `large` pressure before a pot is established, or remember that one pressure event already happened before allowing a second bluff-catch.
