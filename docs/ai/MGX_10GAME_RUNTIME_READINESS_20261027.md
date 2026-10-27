# 10-Game Beginner / Standard runtime readiness — 2026-10-27

Source tested: `8ed49e76fea6e0209e6aafeec64341a68982cece` (`origin/main`). This is a local Chromium run with a stubbed QA API, not production, physical-device, strength, or completed-hand evidence. The 37-game publication candidate is a separate checkout and was not changed.

The fixed rotation is `B01/B02/B06/ST3/ST1/ST2/D01/B05/D03/S01`. The static [10-Game plan](../../src/rl/training/ten_game_rl_plan.py) reports 20/20 Beginner/Standard model registrations with assets and expected dimensions; it explicitly reports `longRlReady=false`. A registered model does not establish that the table calls it.

## Current browser measurement

`tests/e2e/cpu-inference-evidence.spec.ts` ran all 10 variants at both tiers: 20/20 tests passed, 20/20 expected phase sets were observed, and no page errors were recorded. The [per-decision evidence](../../reports/readiness/ten-game-20-runtime-20261027.json) contains source commit, phase, tier, model IDs, status, reason, elapsed time, and hashes of the 20 raw captures in `reports/10game-runtime-20261027/raw/`.

| Rotation positions | Beginner / Standard runtime result | Model or decision path |
| --- | --- | --- |
| `D03` Badugi | 2/2 model used, 16 observed decisions | Beginner `model-badugi-sixmax-standard-dqn-v2`; Standard `model-badugi-sixmax-standard-e11` |
| `D01`, `S01` 2-7 draw | 4/4 model used, 36 observed decisions | Beginner `model-27draw-beginner-dqn-v1`; Standard `model-27draw-standard-dqn-v1` |
| `B01`, `B02`, `B05`, `B06` board | 0/8 model used, 8 observed decisions | `not-connected`, `automatic-check-call` |
| `ST1`, `ST2`, `ST3` Stud/Razz | 0/6 model used, 6 observed decisions | `not-connected`, `automatic-check-call` |

Thus 6/20 tested tier routes used a model, and 14/20 used the non-model table path. The not-connected rows each sample one action; they establish the sampled path, not every state or street. The six used routes confirm actual local inference for sampled BET/DRAW phases; they do not establish model strength, training-environment parity, or a complete mixed-game session.

## Work required before training or promotion

1. Connect the board and Stud table actions only after the live observation, legal-action mask, betting limits, bring-in/complete, street state, and model output are compared against the actual controller. Their current `automatic-check-call` behavior means another long training run alone would not change the player-facing CPU.
2. Extend F03 parity evidence to all 10 variants, including D01 triple versus S01 single draw, Badugi six-seat observation, board split pots, and Stud visible cards. Existing focused tests passing is not a full F03 sign-off.
3. Define independent short evaluation and stop conditions for each candidate. Do not overwrite deployed models with training output or infer Beginner/Standard strength from registry status or these browser traces.
4. Satisfy F04 storage, checkpoint restore, memory, and single-job budget before any Windows trial or long run. The last Windows audit found only the system drive and low free memory; no trial was started here.

Reproduction (from a clean checkout with dependencies installed):

```sh
E2E_APP_URL=http://127.0.0.1:3017/dev/ MGX_EVIDENCE_VARIANTS=B01,B02,B06,ST3,ST1,ST2,D01,B05,D03,S01 MGX_EVIDENCE_TIERS=beginner,standard npx playwright test tests/e2e/cpu-inference-evidence.spec.ts --project=badugi-flow --workers=1 --output=reports/10game-runtime-20261027/raw
node scripts/summarize-mgx-inference-evidence.mjs --input reports/10game-runtime-20261027/raw --output reports/readiness/ten-game-20-runtime-20261027.json --source-commit 8ed49e76fea6e0209e6aafeec64341a68982cece --expected-variants B01,B02,B06,ST3,ST1,ST2,D01,B05,D03,S01 --expected-tiers beginner,standard
```

The first command requires a local development server at the URL shown. The summarizer rejects missing or extra variant/tier evidence and source changes in runtime files. Re-run with a new source commit before treating later code as verified.
