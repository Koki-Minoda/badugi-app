# MGX Pro Step4 Improvement Report

Baseline: Step4-A (`reports/ai-eval/pro-vs-standard-20260506.json` from the previous revision)  
Step4-B evaluation seeds: `20260506`, `20260507`  
Hands per variant: `100`

## Improvement Summary

| Variant | Before EV | After EV (20260506) | Standard EV (20260506) | Fallback Before | Fallback After | Fix |
| ------- | ---------: | ------------------: | ---------------------: | --------------: | -------------: | --- |
| D03 | 7.5 | 7.5 | 7.5 | 0.5714 | 0.0000 | Added explicit Badugi betting branches for made hands, weak draws, and expensive-call defense. |
| D01 | -112.8 | -72.4 | 102.4 | 0.0000 | 0.2510 | Rebalanced final-round 2-7 betting so rough 9-lows stop raising, strong 7-lows still value-bet, and paired penalty hands avoid expensive calls. |
| D02 | -87.0 | -93.4 | 123.4 | 0.0000 | 0.2671 | Tightened weak 8/9-low aggression and restored value betting for wheel and premium 6/7-lows without straight/flush penalties. |
| S01 | -29.0 | -8.2 | 38.2 | 0.0000 | 0.2684 | Split single-draw post-draw betting from triple-draw rules and pushed weak one-draw finals toward check/fold. |
| S02 | -28.6 | -7.8 | 37.8 | 0.0000 | 0.2603 | Added A-5 single-draw value-bet-only branches for strong made lows and removed loose triple-draw style raises. |

## Cross-Seed Check

| Variant | Pro EV (20260506) | Pro EV (20260507) | Standard EV (20260507) | Fallback 20260506 | Fallback 20260507 | Verdict |
| ------- | ----------------: | ----------------: | ---------------------: | ----------------: | ----------------: | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0000 | 0.0000 | STABLE_NEUTRAL |
| D01 | -72.4 | -20.6 | 50.6 | 0.2510 | 0.2476 | IMPROVED_BUT_BELOW_STANDARD |
| D02 | -93.4 | -96.8 | 126.8 | 0.2671 | 0.2601 | STILL_WEAK |
| S01 | -8.2 | 4.2 | 25.8 | 0.2684 | 0.2606 | IMPROVED_BUT_BELOW_STANDARD |
| S02 | -7.8 | -7.2 | 37.2 | 0.2603 | 0.2497 | IMPROVED_BUT_BELOW_STANDARD |

## Safety Check

| Variant | Illegal Rate | Freeze Rate | EV Fail Rate | Status |
| ------- | -----------: | ----------: | -----------: | ------ |
| D03 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| D02 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S01 | 0.0000 | 0.0000 | 0.0000 | PASS |
| S02 | 0.0000 | 0.0000 | 0.0000 | PASS |

## Key Findings

| Finding | Severity | Notes |
| ------- | -------- | ----- |
| The fallback gate is now clear on every target variant. | HIGH | All five target variants are below `0.30` fallback on both seeds, with `D03` down to `0.0000`. |
| D01 improved materially, but it is still losing after the last draw. | HIGH | The EV gap versus Standard shrank, but Pro still under-defends or under-values too many late 8/9-low spots. |
| D02 remains the weakest lowball betting variant. | HIGH | Coverage is present, but the current A-5 post-draw thresholds are still bleeding EV on marginal and paired finals. |
| S01/S02 no longer inherit the worst triple-draw aggression leak. | MEDIUM | Single-draw EV improved sharply from Step4-A, but value betting is still too conservative relative to Standard. |
| Safety remains stable while Pro ownership stays high. | MEDIUM | `illegalActionRate`, `freezeRate`, and `evIntegrityFailureRate` stayed at `0` while `proOverlayRate` remained around `0.73` to `1.00`. |

## Commands Run

- `npm run test:ai:pro`
- `npm run eval:ai:pro -- --hands=100 --seed=20260506 --variants=D03,D01,D02,S01,S02`
- `npm run eval:ai:pro -- --hands=100 --seed=20260507 --variants=D03,D01,D02,S01,S02`
- `npm run test:game:one-hand`
- `npm run test:game:ev`
- `npm run test:rl:safety`
- `node src/ai/evaluation/analyzeProLeaks.js reports/ai-eval/pro-vs-standard-20260506.json docs/ai/MGX_PRO_LEAK_ANALYSIS.md docs/ai/MGX_PRO_STEP4B_LEAK_CLASSIFICATION.md`
