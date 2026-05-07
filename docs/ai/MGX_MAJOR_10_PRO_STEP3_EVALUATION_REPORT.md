# MGX Major 10 Pro Step3 Evaluation Report

Seed: `20260506`  
Hands per variant: `40`  
Player count: `6`  
JSON: `reports/ai-eval/pro-vs-standard-20260506.json`

## Evaluation Summary

| Variant | Hands | Completed | Pro EV/Hand | Standard EV/Hand | Pro WinRate | Standard WinRate | Illegal Rate | Freeze Rate | EV Fail Rate | Verdict |
| ------- | ----: | --------: | ----------: | ---------------: | ----------: | ---------------: | -----------: | ----------: | -----------: | ------- |
| D03 | 40 | 40 | 7.5 | 7.5 | 1.0000 | 1.0000 | 0.0000 | 0.0000 | 0.0000 | PRO_NEUTRAL |
| D01 | 40 | 40 | -164.5 | 194.5 | 0.0583 | 0.2750 | 0.0000 | 0.0000 | 0.0000 | PRO_WORSE |
| D02 | 40 | 40 | -140.5 | 170.5 | 0.1167 | 0.2167 | 0.0000 | 0.0000 | 0.0000 | PRO_WORSE |
| S01 | 40 | 40 | -9.0 | 39.0 | 0.1417 | 0.1917 | 0.0000 | 0.0000 | 0.0000 | PRO_WORSE |
| S02 | 40 | 40 | 16.5 | 13.5 | 0.1500 | 0.1833 | 0.0000 | 0.0000 | 0.0000 | PRO_BETTER |
| B01 | 40 | 0 | - | - | - | - | - | - | - | NOT_RUN |
| B05 | 40 | 0 | - | - | - | - | - | - | - | NOT_RUN |
| B06 | 40 | 0 | - | - | - | - | - | - | - | NOT_RUN |
| ST1 | 40 | 0 | - | - | - | - | - | - | - | NOT_RUN |
| ST3 | 40 | 0 | - | - | - | - | - | - | - | NOT_RUN |

## Safety Summary

| Variant | Illegal Action | Freeze | EV Integrity | Fallback Rate | Status |
| ------- | -------------- | ------ | ------------ | ------------: | ------ |
| D03 | 0.0000 | 0.0000 | 0.0000 | 0.5714 | PASS |
| D01 | 0.0000 | 0.0000 | 0.0000 | 0.5472 | PASS |
| D02 | 0.0000 | 0.0000 | 0.0000 | 0.5463 | PASS |
| S01 | 0.0000 | 0.0000 | 0.0000 | 0.5795 | PASS |
| S02 | 0.0000 | 0.0000 | 0.0000 | 0.5536 | PASS |
| B01 | - | - | - | - | NOT_RUN: NEEDS_PRO_RULES |
| B05 | - | - | - | - | NOT_RUN: NEEDS_PRO_RULES |
| B06 | - | - | - | - | NOT_RUN: NEEDS_PRO_RULES |
| ST1 | - | - | - | - | NOT_RUN: NEEDS_PRO_RULES |
| ST3 | - | - | - | - | NOT_RUN: NEEDS_PRO_RULES |

## Pro Overlay Usage

| Variant | Pro Overlay Rate | ONNX Rate | Standard Fallback Rate | Safe Fallback Rate | Notes |
| ------- | ---------------: | --------: | ---------------------: | -----------------: | ----- |
| D03 | 0.4286 | 0.0000 | 0.0000 | 0.5714 | Badugi betting path is still dominated by safe fallback. |
| D01 | 0.4528 | 0.0000 | 0.5472 | 0.0000 | Overlay is active, but value/betting quality is losing EV. |
| D02 | 0.4537 | 0.0000 | 0.5463 | 0.0000 | Overlay is active, but A-5 heuristics are still weaker than Standard. |
| S01 | 0.4205 | 0.0000 | 0.5795 | 0.0000 | Single-draw path is using fallback more than overlay. |
| S02 | 0.4464 | 0.0000 | 0.5536 | 0.0000 | Slight EV gain, but fallback dependency remains high. |

## Regression Findings

| Finding | Variant | Severity | Suggested Fix |
| ------- | ------- | -------- | ------------- |
| Pro EV drops sharply against Standard despite stable safety metrics. | D01 | HIGH | Rework strong pat/value raise thresholds and post-draw betting rules. |
| Pro EV drops sharply in A-5 lowball after initial draw improvements. | D02 | HIGH | Tighten pat thresholds and reduce overconfident value betting. |
| Single-draw Pro loses EV versus Standard. | S01 | HIGH | Separate single-draw betting heuristics from triple-draw defaults. |
| WinRate is not discriminative because all seats are counted as winners in many completed hands. | D03 | MEDIUM | Fix Badugi showdown winner extraction before trusting WinRate. |
| Fallback usage stays above 54% across all required variants. | D03/D01/D02/S01/S02 | MEDIUM | Move more betting decisions from fallback to explicit Pro rules. |

## Step4 Readiness

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Pro safety stable | PASS | Required variants completed with illegal/freeze/EV failure rates at `0`. |
| Pro better than Standard in target games | FAIL | Only `S02` improved; `D01`, `D02`, `S01` regressed and `D03` stayed neutral. |
| No EV integrity failures | PASS | `0` across all executed variants. |
| No freeze | PASS | `0` across all executed variants. |
| Ready for Iron self-play | NO | Safety is stable, but EV evidence is not strong enough and D03 WinRate metric is not trustworthy yet. |
