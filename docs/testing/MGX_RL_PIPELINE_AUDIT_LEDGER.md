# MGX RL Pipeline Audit Ledger

Audit date: 2026-05-06

Scope: Badugi / Draw-family RL data pipeline aligned to the current 96-dim frontend ONNX path.

| Area | Expected from Plan | Actual Implementation | Match | Risk | Notes |
|---|---|---|---|---|---|
| Badugi observation schema | `badugi-observation-v1`, 96 slots | `src/rl/badugiObservationSchema.js` exports `BADUGI_OBSERVATION_VECTOR_SIZE = 96` and normalizes vectors to 96 | Yes | Low | `BadugiEngine.getObservation()` is covered by existing schema test |
| Draw observation schema | `draw-observation-v1`, 96 slots for D01/D02/S01/S02 | `src/rl/drawObservationSchema.js` exports `DRAW_OBSERVATION_VECTOR_SIZE = 96` and variant configs for D03/D01/D02/S01/S02 | Yes | Low | Single draw variants carry `drawRounds: 1` |
| ONNX feature builder | frontend ONNX feature tensors must match model input shape | `buildBadugiOnnxFeatures` and `buildDrawOnnxFeatures` throw on mismatched length | Yes | Low | Invalid shape logs warning and returns fallback from inference wrapper |
| Model registry | Badugi / Draw model entries use `[96]` | D03 specific model entries are `[96]`; D01/D02/S01/S02 model entries are `[96]` | Yes | Medium | Generic fallback model remains `[64]`; it is not a Badugi/Draw-specific model |
| Tier routing | variant/tier routes to variant-specific model when available | `selectModelForVariant` resolves exact variant + tier before generic tier | Yes | Low | D03 beginner defaults to generic unless explicit legacy character model is requested |
| Backend fallback API | `/api/badugi/rl/decision` is comparison/fallback, schema v1 / 96-dim | `backend/app/api/badugi_rl.py` validates schema version, vector length, and valid actions | Yes | Low | Response source is deterministic-safe |
| `recordActionToLog` | hand/seat/phase/action/stacks/bets/pot/draw metadata are preserved | `src/ui/App.jsx` records handId, playerId, phase, seat, action, stack/bet before/after, paid, toCall, potAfter, drawInfo, bet/draw round | Mostly | Medium | It does not always store pre-action `stateVector`; exporter pads missing vectors, so live log export quality depends on caller metadata |
| Hand history / action log | RL dataset can reconstruct action sequence and result | `appendHandHistoryAction`, canonical events, and `saveRLHandHistory` preserve action/draw/result summaries | Mostly | Medium | Human benchmark logging currently stores Badugi only by default |
| `export_dataset.py` transition | emits observation/action/reward/next_observation/done/legal_actions | `src/rl/tools/export_dataset.py` emits transition records | Yes | Medium | Patched to normalize `DRAW` to `draw_N`, preserve top-level `variantId`, and attach warning flags |
| `badugi_env.py` training observation | 96-dim padded/compatible training observation | `BadugiEnv.observation_space` is `(96,)` and action space is 6 | Yes | Medium | Env mechanics remain simplified versus production fixed-limit/multiway engine |
| D01/D02/S01/S02 observation | all use 96-dim draw schema and correct variant slots | `getDrawVariantRlConfig` maps low-27 / low-a5 and draw rounds | Yes | Low | New audit test checks vectors and model routing |
| Legal action mask | observation action mask must align with legal actions | Badugi mask slots 32-37; Draw mask slots 48-58 | Yes | Low | New audit test checks Badugi and draw mask slots |
| Fallback priority | ONNX -> rule-based -> deterministic safe | `BADUGI_RL_FALLBACK_PRIORITY` and adapter expose this order | Yes | Low | Inference returns null for missing/invalid ONNX so caller can continue fallback |
| Reward calculation | reward is numeric and not missing in transitions | exporter derives numeric reward from explicit reward/action/paid | Partial | Medium | Reward remains heuristic when action log does not provide explicit terminal chip delta |

