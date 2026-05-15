# MGX Pre-Iron Source Audit

Purpose: classify the remaining uncommitted source files before Iron bootstrap work starts.

Classification:
- `A`: commit now before Iron bootstrap
- `B`: hold for a separate branch/commit
- `C`: revert/delete candidate

| File | Classification | Reason | Action |
| ---- | -------------- | ------ | ------ |
| `src/ai/cpuCharacters.js` | `A` | JSON module import compatibility fix for AI runtime config loading. Small, clear, and covered indirectly by passing AI tests. | `COMMIT_NOW` |
| `src/ai/difficultyAdjuster.js` | `A` | JSON module import compatibility fix for tier/difficulty selection. AI-tier related and low risk. | `COMMIT_NOW` |
| `src/ai/modelRouter.js` | `A` | Runtime-critical JSON module import fix for model registry loading. Directly affects Pro/Iron routing and safety tests already pass. | `COMMIT_NOW` |
| `src/ai/pro/proDecisionOverlay.js` | `A` | Adds blocked-override metadata inference without changing fallback behavior. Useful for guard attribution and replay/debugging, and `fallback=0` remains intact. | `COMMIT_NOW` |
| `src/ai/tierManager.js` | `A` | JSON module import compatibility fix for tier config loading. Tied to AI tier routing and already exercised by tests. | `COMMIT_NOW` |
| `src/ai/tierPolicySmoke.js` | `A` | JSON module import compatibility fix for AI smoke tooling. Not user-facing logic, but part of the AI verification path. | `COMMIT_NOW` |
| `src/games/config/variantCatalog.js` | `A` | Runtime-critical JSON module import fix. `proDecisionOverlay` uses variant family inference from this file, so it belongs with AI routing safety. | `COMMIT_NOW` |
| `src/games/draw/DeuceToSevenTripleDrawController.js` | `A` | Preserves Pro metadata on controller-produced actions. Relevant to D01/D02 evaluation traces and safe to keep with Step4/Iron transition work. | `COMMIT_NOW` |
| `src/config/tournamentBlindSheets.js` | `B` | Same JSON import compatibility pattern, but tournament blind-sheet loading is orthogonal to Pro/Iron bootstrap. Mixing it into AI transition commits adds noise. | `HOLD` |
| `src/ai/pro/frequencyControl.js` | `C` | Runtime-unused Step4-G experiment residue. Current references are tests only; main decision path no longer imports it. Deleting it cleanly would require trimming historical frequency tests first. | `NEEDS_REVIEW` |

## Notes

- `src/ai/pro/frequencyControl.js` is not imported by production Pro routing. Current references are in `src/ai/pro/__tests__/proDecisionOverlay.test.js` only.
- `src/ai/evaluation/runAiEvaluationBatch.js` still supports `metadata.frequencyControlled`, but that does not require the helper file to exist unless runtime decisions set that metadata.
- The AI/runtime-safe cluster is mostly a JSON import compatibility sweep plus two meaningful behavior/meta fixes:
  - `src/ai/pro/proDecisionOverlay.js`
  - `src/games/draw/DeuceToSevenTripleDrawController.js`

## Recommended Commit Units

1. AI runtime compatibility and routing:
   - `src/ai/cpuCharacters.js`
   - `src/ai/difficultyAdjuster.js`
   - `src/ai/modelRouter.js`
   - `src/ai/tierManager.js`
   - `src/ai/tierPolicySmoke.js`
   - `src/games/config/variantCatalog.js`

2. Pro overlay / evaluation metadata preservation:
   - `src/ai/pro/proDecisionOverlay.js`
   - `src/games/draw/DeuceToSevenTripleDrawController.js`

3. Separate follow-up review:
   - `src/config/tournamentBlindSheets.js`
   - `src/ai/pro/frequencyControl.js`
