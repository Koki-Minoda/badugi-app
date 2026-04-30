# ONNX Model Assets

Place production ONNX policy files in this directory and reference them from
`src/config/ai/modelRegistry.json` with paths like `models/<name>.onnx`.

Current repository state:

- The registry contains Badugi and draw-family model entries.
- Production `.onnx` assets are not committed here yet.
- Runtime code must keep using the configured fallback path when a model file is
  unavailable.

Release checklist:

- Add the `.onnx` file under `public/models/`.
- Compute its SHA-256 checksum and set `checksumSha256` in
  `src/config/ai/modelRegistry.json`.
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

- `model-badugi-pro-v1`, `model-badugi-iron-v1`, and
  `model-badugi-worldmaster-v1` are marked production-required, but the real
  `.onnx` files and checksums have not been supplied yet.
