# D03 Phase 1: frozen ONNX evaluation path

`src/rl/evaluation/run_frozen_badugi_eval.py` connects the existing real-controller ONNX collector, independent hand-trace auditor, and finite-look candidate gate. It evaluates a candidate and the published Pro in separate sessions. The output is a `PROMOTE` / `REJECT` / `CONTINUE` **candidate recommendation**, never a production adoption or release command.

## Preflight contract

Before collecting any hand, create a plan (`mgx-sequential-gate/v2`) and candidate/reference manifests with `status=FROZEN`. Store their original bytes outside the checkout. Each manifest must contain the plan SHA256, code Git SHA, actual ONNX body SHA256, controller contract SHA256, seed base, exact 40-cell matrix, the last planned look’s session count per cell, 20 hands per session, and `requireDecisionLedger=true`. The plan fixes the three primary metrics, score bounds from conserved chips, improvement margin, familywise error rate, planned looks, per-arm hand and wall-time budgets, inference deadline, and seed exclusion windows. The runner checks the complete scheduled seed set against both windows and checks `2^32` aliases because the D03 controller coerces random seeds to 32 bits. It additionally scans recorded local D03 and Phase 1 manifests/session originals and saves a seed-history preflight; missing external originals remain outside that scan.

The candidate ONNX stays in an isolated path outside `public/models`. The Pro ONNX is read from its published path. The runner verifies both body hashes before starting, rejects a dirty tracked checkout, and runs the arms serially on the local machine. It cannot certify that a plan was created before a prior, unrelated exploration; plan creation time and seed-history completeness still need independent review.

## Collection and audit

The controller emits optional all-seat stack and committed-chip ledgers at every decision and settled stacks at hand end. The model collector writes raw sessions and hands incrementally to `.partial` files, then renames them only after completion. A failure leaves the partial originals and an isolated failure record. The independent adapter checks the event/ledger sequence, per-seat stack and committed-chip transitions, legal actions and amounts, hand and session chip continuity, normal ONNX use, no fallback, and inference deadline. The last public BET event may show the settled winner stack after pot award; the adapter checks this against the terminal ledger instead of incorrectly treating it as an immediate bet debit.

Only complete, hash-matched originals enter the statistical gate. For later looks, pass `--previous-look` with the preceding output directory. The runner verifies the prior plan, manifests, model SHA, code SHA, raw traces, audit, cumulative rows, and gate result; it then collects only new session indices. It excludes only that attested evaluation chain from its local seed-history scan, concatenates the audited rows, and applies the same frozen gate to all sessions so far. A prior decision other than `CONTINUE` or a skipped look stops collection. The gate counts independent 20-hand sessions, preserves the full cash/MTT and 2/3/6-seat matrix, and keeps every opponent cell visible. At a planned look it uses a familywise bounded interval. The result carries the plan, manifests, model bodies, raw-audit, and converted-session hashes. The gate never writes to the public model registry.

## Run

Invoke the runner with a Python environment containing `src/rl/requirements.txt` and with installed Node dependencies. Choose an output directory that does not yet exist.

```sh
python src/rl/evaluation/run_frozen_badugi_eval.py \
  --plan /isolated/phase1/plan.json \
  --candidate-manifest /isolated/phase1/candidate-manifest.json \
  --reference-manifest /isolated/phase1/reference-manifest.json \
  --candidate-model /isolated/models/iron-candidate.onnx \
  --reference-model public/models/badugi_pro_controller_v2_20261105.onnx \
  --prior-artifacts-root /isolated/MGX-RL-Artifacts \
  --look 2 --output /isolated/phase1/look-2

# If the first gate says CONTINUE and the frozen plan includes look 4:
python src/rl/evaluation/run_frozen_badugi_eval.py \
  --plan /isolated/phase1/plan.json \
  --candidate-manifest /isolated/phase1/candidate-manifest.json \
  --reference-manifest /isolated/phase1/reference-manifest.json \
  --candidate-model /isolated/models/iron-candidate.onnx \
  --reference-model public/models/badugi_pro_controller_v2_20261105.onnx \
  --prior-artifacts-root /isolated/MGX-RL-Artifacts \
  --previous-look /isolated/phase1/look-2 \
  --look 4 --output /isolated/phase1/look-4
```

Set the plan's `evaluationPurpose` to `PHASE1_WIRING_DIAGNOSTIC_ONLY` for the small first look. Its `candidatePromotionEligible` output remains false regardless of the mathematical gate decision. A future candidate run must freeze `PROMOTION_CANDIDATE` before collecting data. The wiring diagnostic cannot establish Iron strength. Independent final opponents, a separate final evaluation, abnormal timeout/fallback injection, normal UI model-use evidence, and human product approval remain later gates. Historical H33b sessions and all Phase 1 diagnostics are excluded from a new candidate's final holdout.
