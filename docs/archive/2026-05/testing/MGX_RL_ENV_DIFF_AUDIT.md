# MGX RL Env Difference Audit

Audit date: 2026-05-06

`badugi_env.py` and `draw_lowball_env.py` are lightweight training mechanics. They are useful for model bootstrap and checkpoint comparison, but they are not a byte-for-byte reproduction of the production game controllers.

| Area | Real Game | badugi_env.py | Difference | Training Risk | Action |
|---|---|---|---|---|---|
| Observation shape | Badugi / Draw frontend ONNX uses 96-dim schema | `BadugiEnv.observation_space` is `(96,)` | Shape aligned | Low | Keep shape tests active |
| Player count | Production supports 2-6+ seats and MTT reseat/merge | Env samples `table_size` 2-6 with simplified opponent aggregate | Opponents are abstracted, not full table actors | Medium | Mark env data with source before mixing with real logs |
| Betting flow | Production has fixed-limit streets, cap, all-in, side pots, turn order | Env uses simplified fixed-limit action loop and immediate transitions | Turn-order and side-pot behavior are simplified | Medium | Do not use env-only data to validate production progression |
| Draw flow | Production applies controller/deck/discard rules per variant | Env draws toward heuristic Badugi/lowball goals | Draw replacement policy is synthetic | Medium | Mix only with source marker and keep real-log gate separate |
| Reward | Production reward should follow chip EV / result / tournament context | Env uses shaped reward plus terminal stack delta | Reward includes teaching bias | Medium | Use env reward for bootstrap, not final human-strength claim |
| Badugi evaluator | Production evaluator and env evaluator both compare Badugi low | Env evaluator is local Python implementation | Same game concept, independent implementation | Low | Keep evaluator fixture tests for real game separately |
| Backend API | Backend endpoint is comparison/fallback only | Env does not call backend | No direct runtime connection | Low | No action |
| Dataset mixing | Real logs have action/result context | Env replay buffer stores obs/action/reward/next_obs/done/action mask | Different source semantics | Medium | Require `source` or training run metadata for mixed datasets |
| Draw lowball | Real D01/D02/S01/S02 use JS engine/controller | `draw_lowball_env.py` uses simplified fixed-limit heads-up/training table | Good for model bootstrap, not progression oracle | Medium | Keep D01/D02/S01/S02 real-controller smoke separate |

Training action: env-derived data is allowed only as synthetic/bootstrap data. Real play-log and env data should not be silently merged without source metadata.

