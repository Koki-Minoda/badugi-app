# AI / RL Pipeline Notes (Spec 18 Snapshot)

- **Layered AI**: `config/ai/tiers.json`, `src/ai/tierManager.js`, `src/ai/policyRouter.js`
- **Opponent modeling**: `src/ai/opponentModel.js`
- **NPC integration**: `ui/App.jsx` uses policy router for BET/DRAW and updates opponent stats.
- **RL export**: `rl/tools/export_dataset.py` converts in-app JSONL logs to datasets.
- **Playwright hooks**: `window.__BADUGI_E2E__` exposes helpers to rotate Mixed Game and inject rule warnings for automated tests.
- **ONNX inference**: `onnxruntime-web` + `src/ai/modelRouter.js` + `src/ai/onnxPolicyAdapter.js` dynamically load per-variant models (Iron/WorldMaster tiers) and override rule-based decisions when models are available.

Next steps:
1. Hook ONNX inference runtime for Iron/WorldMaster tiers.
2. Extend opponent modeling with VPIP/PFR metrics from `recordActionToLog`.
3. Automate dataset builds via CI (call `export_dataset.py` on exported logs).
