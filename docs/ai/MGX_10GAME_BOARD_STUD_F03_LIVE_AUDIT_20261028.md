# 10-Game board / Stud F03 live-input audit — 2026-10-28

This is a local Chromium first-betting-turn audit on the independent 10-Game branch. The QA API was stubbed. It does not establish later-street behavior, physical-device quality, model strength, or full F03 parity. The seven raw snapshots are in `reports/10game-f03-live-20261027/raw/`; they contain counts and field names, not card identities. The separate 37-game publication checkout was not changed.

The registered Beginner and Standard models for `B01/B02/B05/B06/ST1/ST2/ST3` have 16 inputs and six action scores. All seven variants reached a live `BET` controller state with a funded actor and no browser errors (7/7 Playwright cases). The previously captured 20-route runtime audit found all 14 corresponding board/Stud tier routes taking `automatic-check-call`, not model inference. Offline synthetic fixtures passed 94/94, but did not cover these live inputs.

| Variant | First street | Actor / seats | Current bet / pot / actor stack | Hole / exposed / board cards | `toCall` derived from snapshot |
| --- | --- | --- | --- | --- | --- |
| B01 NLH | PREFLOP | 3 / 6 | 20 / 30 / 500 | 2 / — / 0 | 20 |
| B02 FLH | PREFLOP | 3 / 6 | 20 / 30 / 500 | 2 / — / 0 | 20 |
| B05 PLO | PREFLOP | 3 / 6 | 20 / 30 / 500 | 4 / — / 0 | 20 |
| B06 PLO-8 | PREFLOP | 3 / 6 | 20 / 30 / 500 | 4 / — / 0 | 20 |
| ST1 Stud | THIRD | 3 / 6 | 10 / 10 / 500 | 3 / 1 / 0 | 10 |
| ST2 Stud-8 | THIRD | 0 / 6 | 10 / 10 / 500 | 3 / 1 / 0 | 10 |
| ST3 Razz | THIRD | 3 / 6 | 10 / 10 / 500 | 3 / 1 / 0 | 10 |

`toCall`, `potSize`, seat count, actor stack, and the street can be derived from a controller snapshot. The snapshot does not itself supply the model's `betSize`, `chipUnit`, `strength`, `drawPotential`, normalized `position`, `raiseCount`, `stackRatio`, or legal-action mask. Board models also require `equity`; Stud/Razz require `visiblePressure`, `lowPotential`, and `highPotential`. These values may eventually be calculated from cards and game rules, but no live calculation was shown to match the training definitions. They must not silently become zero or a copy of another feature.

The Python training observation expresses `to_call`, `bet_size`, and `pot_size` as fractions of a fixed chip unit; `stack_ratio` is a separate feature. Dividing live chip values by the actor's *remaining* stack would change their meaning as the hand progresses. The JS builders now accept an explicit `chipUnit` for those three fractions, retain already-normalized `position`/`streetProgress`, and convert index forms only when supplied. Inference for these two feature sets now rejects absent explicit values and legal actions before running the model. When both `chipUnit` and `stackRatio` are explicit, it does not also require an actor stack that is unused by the resulting vector. Direct static fixture builders retain defaults for their offline tests; the inference gate is the live safety boundary. A `chipUnit` value itself must be justified for each cash/tournament configuration before model connection.

The action indexes agree at a label level (`fold/check/call/bet/raise/all_in`), but label equality is insufficient. The controller uses `all-in`, has separate Stud `complete`/bring-in behavior, FLH and Stud fixed betting units/caps, PLO pot limits, and NLH reopening rules. The current generic ONNX decoder derives a `raiseSize` from an action score; the Python six outputs are action values, not sizing predictions. No live board/Stud action bridge or variant-specific legal mask/sizing translation was established here. Therefore **0/14 board/Stud Beginner/Standard routes are safe to connect** on this evidence. They remain registered but not live-used; none is promoted or strength-qualified by this audit.

Next F03 work: define documented per-family live feature producers and a fixed chip-unit convention; compare JS vectors with Python observations on the same hand-state fixtures at first and later streets; derive legal actions and bet/raise amounts from controller rules including bring-in, caps, all-ins and split pots; run full-hand browser traces at both tiers and short independent evaluation before connecting any route. F04 storage, checkpoint restore, memory budget and a bounded trial must be satisfied before long Windows training. No training was started by this audit.

## F04 preparation status

The read-only Windows recheck (2026-10-28) still showed only `C:` with 81,147,109,376 bytes free, 8,265,096 KiB physical RAM, and 2,290,696 KiB free RAM. The existing Windows launcher checks a minimum of 8 GB free for Train/Resume, but that alone does not meet the documented dedicated non-system artifact destination requirement. `MGX_RL_ARTIFACT_ROOT` is not established, a 10-Game checkpoint save/restore has not been demonstrated, and peak memory and a one-job budget are unknown. The safe sequence is: provision and verify a dedicated artifact destination; choose one variant and a bounded small run; record memory and checkpoint hashes; restore from that exact checkpoint into a separate output directory and compare continuation metadata; then set a single-job stop budget. This is preparation, not an authorization to start long training or promote any model.

Reproduce the seven browser snapshots with a local development server:

```sh
E2E_APP_URL=http://127.0.0.1:3017/dev/ npx playwright test tests/e2e/board-stud-f03-live-trace.spec.ts --project=badugi-flow --workers=1 --output=reports/10game-f03-live-20261027/raw
```
