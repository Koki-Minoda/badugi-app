# D03 Phase 1: decision-level controller chip ledger

## Scope and result

The optional `includeLedger` response field exposes every seat's stack and committed chips at each controller decision. The controller checks that their sum equals the frozen session chip pool. At hand end it exposes all settled stacks and checks the same pool. The existing bridge defaults to omitting this field, so current consumers keep their response shape.

The isolated diagnostic at `scripts/audit_badugi_controller_step_ledger.py` ran 1,600 real-controller hands and checked 24,594 decision snapshots. It covered cash and MTT, 2/3/6 occupied seats (including 6-table/2-occupied and 6-table/3-occupied), and passive, pressure, draw-heavy, and random-legal scripted opponents. Each of the 40 cells contains two independent 20-hand sessions. It also checked the controller's legal mask, selected action and recorded amount, stack changes between decisions, final all-seat chip deltas, and stack continuity between hands.

Result: `PASS_CONTROLLER_LEDGER_DIAGNOSTIC_ONLY`. Raw JSONL and the summary are retained outside the checkout at `/Users/koki/Documents/Codex/MGX-RL-Artifacts/mgx-phase1-step-ledger-20261116/`. SHA256 of `hand-ledgers.jsonl`: `69395a818a1fcf197e55f36f46b8dee6a971c24a55cc45d3bd98d75d8e8b6003`. The summary records the controller and bridge source hashes and every cell count.

## Reproduce

Use a new, empty output path. The command does not train, evaluate model strength, or write to the public model registry.

```sh
python3 scripts/audit_badugi_controller_step_ledger.py \
  --output /path/to/new/audit-directory \
  --hands-per-session 20 --sessions-per-profile 2 --seed-base 991176001
python3 -m unittest src/rl/__tests__/test_badugi_controller_step_ledger.py
npx vitest run src/rl/__tests__/badugiControllerInteractiveV2Draft.test.js
```

## Evidence boundary

The diagnostic uses scripted seats. It is controller rule/safety evidence only; no Pro/Iron ONNX inference, unknown human strategy, or human G5 play is represented. It observes decision boundaries and hand settlement, not every internal pot mutation. The seed set is diagnostic only and must not enter a future candidate's holdout. The historical H33b holdout remains ineligible for reuse. This result does not authorize Iron promotion or release.
