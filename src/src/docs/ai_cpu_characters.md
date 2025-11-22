# AI CPU Tier Assignments

This list maps every CPU tier (Spec19) to the ONNX policy model that drives its decision logic. Use it to understand which trained policy powers a given NPC profile and to correlate RL dataset outputs (`recordActionToLog`, `rl/tools/export_dataset.py`) with the corresponding CPU characters.

| Tier | ONNX Model | Path | Notes | Sample Characters |
| --- | --- | --- | --- | --- |
| Beginner | `model-generic-v1` | `config/ai/models/nlh_standard.onnx` (generic) | Light aggression, high randomness; uses the generic Hold'em-oriented policy for entry-level opponents. | Rookie Scout, Patio Dealer |
| Standard | `model-generic-v1` | `config/ai/models/nlh_standard.onnx` | Balanced play, default for ring / mixed pacing. | Table Captain, Neutral NPC |
| Strong | `model-generic-v1` | `config/ai/models/nlh_standard.onnx` | Slightly tighter fold profile; still uses the generic model with stronger thresholds. | Iron Helmsman |
| Pro | `model-badugi-v2` | `config/ai/models/badugi_iron.onnx` | Badugi-specific ONNX binary tuned for pro rotations and mixed formats. | Pro Circuit Hero, Midnight Analyst |
| Iron | `model-badugi-v2` | `config/ai/models/badugi_iron.onnx` | Iron-tier uses the same Badugi model but adds kill/blind rules and trackable KPI constraints. | Iron Warden, Steady Shot |
| WorldMaster | `model-nlh-v1` | `config/ai/models/nlh_worldmaster.onnx` | Highest-fidelity policy for finals; drives the world champion CPU with ONNX-provided raise sizing. | World Chieftain, Finale Oracle |

The `modelId` field inside `config/ai/tiers.json` determines which registry entry to load when `resolveTierModelInfo()` is invoked. Reinforcement learning data exported via `rl/tools/export_dataset.py` can be tied back to these models by storing the tier + variant metadata (`event.metadata.tierId`) before training, allowing you to swap a freshly trained ONNX file into the matching tier's `modelId`.

If you regenerate or replace an ONNX asset, update both `config/ai/modelRegistry.json` and the table above so the runtime loader in `ai/onnxPolicyAdapter.js` can still resolve the correct binary before a CPU action is inferred.
