# ONNX Model Assets

Place production ONNX policy files in this directory and reference them from
`src/config/ai/modelRegistry.json` with paths like `models/<name>.onnx`.

Current repository state:

- The registry contains Badugi and draw-family model entries.
- Production `.onnx` assets are not committed here yet.
- Runtime code must keep using the configured fallback path when a model file is
  unavailable.

Release checklist:

- Verify every registry entry that should be live has a matching `.onnx` file.
- Keep missing experimental entries documented as fallback-only.
- Re-run ONNX adapter tests after adding or replacing model files.
