# ONNX Model Assets

Place production ONNX policy files in this directory and reference them from
`src/config/ai/modelRegistry.json` with paths like `models/<name>.onnx`.

Current repository state:

- The registry contains Badugi and draw-family model entries.
- Badugi production-required `.onnx` assets are committed here so production can
  verify checksums before using them.
- Runtime code must keep using the configured fallback path when an optional
  model file is unavailable.

Release checklist:

- Install supplied `.onnx` files with one of these commands:
  - `npm run ai:install-models -- --model model-badugi-pro-v1=/path/badugi_pro_v1.onnx`
  - `npm run ai:install-models -- --source-dir /path/mgx-models --required-only`
- The install command copies files into `public/models/`, computes SHA-256, and
  updates `checksumSha256` in `src/config/ai/modelRegistry.json`.
- Keep `version` in the registry aligned with the filename and release tag.
- Set `productionRequired: true` only for models that must be live in production.
- Verify every required registry entry has a matching `.onnx` file:
  `npm run ai:verify-models`.
- Local fallback smoke can document missing production assets without failing:
  `npm run ai:verify-models -- --allow-missing`.
- Keep missing experimental entries documented as fallback-only with
  `productionRequired: false`.
- Re-run ONNX adapter tests after adding or replacing model files.

Current blocker:

- `badugi_pro_v1.onnx`, `badugi_iron_v1.onnx`, and
  `badugi_worldmaster_v1.onnx` are currently generated bootstrap policies.
- Bootstrap models are real ONNX files and exercise the frontend ONNX path, but
  they are heuristic initial policies and should later be replaced by trained
  RL checkpoints.
- `badugi_beginner_dqn_v1.onnx` is the evaluator/draw-phase fixed 3k DQN probe
  and is the beginner-tier learned policy while stronger tiers are re-trained.
- `badugi_standard_dqn_v1.onnx` is the street/context-aware 50k DQN checkpoint.
  It clears a standard-tier avgReward gate across opponent profiles, but not the
  stricter Pro/Iron/WorldMaster showdown gate.
- Rebuild the bootstrap set when needed with `npm run ai:build-bootstrap-models`.
