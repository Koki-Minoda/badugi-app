# MGX EV Integrity Report

Last updated: 2026-05-06

## Summary

| Item | Result |
| ---- | ------ |
| EV_GUARD_ENABLED | YES |
| TRAINING_BLOCKED_BY_EV | NO for current fixtures; YES for dirty reward datasets |
| Overall EV Risk | MEDIUM |

The EV guard now runs in focused Vitest coverage and is connected to the one-hand progression harness at terminal state. It detects pot/payout mismatch, folded or ineligible winners, duplicate payouts, non-finite rewards, non-zero-sum rewards, and reward/stack-delta mismatches. Broad progression still treats some chip conservation ambiguity as warnings because several controller snapshots echo terminal result pots differently.

## EV Checks

| Check ID | Area | Status | Notes |
| -------- | ---- | ------ | ----- |
| EV-001 | Chip conservation | PASS | Strict fixture verifies hand-start and hand-end chip totals. |
| EV-002 | Pot payout conservation | PASS | Mismatched pot and payout totals fail. |
| EV-003 | Winner eligibility | PASS | Folded winner is rejected. |
| EV-004 | All-in side-pot eligibility | PASS | Player cannot win a side pot outside eligible seats. |
| EV-005 | Duplicate payout | PASS | Same pot/component/seat duplicate payout is rejected. |
| EV-006 | Fake side pot | PASS | Single-pot fixture can reject unexpected positive side pots. |
| EV-007 | Reward finite | PASS | NaN / Infinity rewards are rejected. |
| EV-008 | Reward sign sanity | PASS | Covered through reward versus stack-delta mismatch. |
| EV-009 | Reward zero-sum | PASS | Terminal non-zero-sum reward map is rejected. |
| EV-010 | Reward matches stack delta | PASS | Seat reward map must explain stack delta when available. |
| EV-011 | Badugi evaluator consistency | PASS | Focused Badugi winner fixture matches evaluator output. |
| EV-012 | 2-7 low evaluator consistency | PASS | Focused D01 lowball fixture matches evaluator output. |
| EV-013 | A-5 low evaluator consistency | PASS | Focused D02 lowball fixture matches evaluator output. |
| EV-014 | Split pot component sum | PASS | Hi/Lo component payout totals match pot amount. |
| EV-015 | Odd chip deterministic | PASS | Odd chip split is deterministic in fixtures. |

## Variant EV Coverage

| Variant | Chip Conservation | Pot Conservation | Winner Eligibility | Reward | Evaluator Match | Status |
| ------- | ----------------- | ---------------- | ------------------ | ------ | --------------- | ------ |
| D03 Badugi | WARN broad / PASS focused | PASS | PASS | PASS | PASS focused | COVERED |
| D01 2-7 Triple Draw | WARN broad / PASS focused | PASS | PASS | PASS | PASS focused | COVERED |
| D02 A-5 Triple Draw | WARN broad / PASS focused | PASS | PASS | PASS | PASS focused | COVERED |
| S01 2-7 Single Draw | WARN broad / PASS focused | PASS | PASS | PASS | Via lowball family path | COVERED |
| S02 A-5 Single Draw | WARN broad / PASS focused | PASS | PASS | PASS | Via lowball family path | COVERED |
| Board / Omaha / Stud / Split | WARN broad | PASS when terminal result provides payouts | PASS | Dataset guard only | Partial | PARTIAL |

## Detected EV Issues

| Issue | Variant | Severity | Repro | Required Fix |
| ----- | ------- | -------- | ----- | ------------ |
| None in current EV fixture and one-hand runs | - | - | `npm run test:game:ev`, `npm run test:game:one-hand` | Keep EV guard enabled. |

## Dataset Reward Audit

| Total | Valid | Invalid | Main Invalid Reason | Training Allowed |
| ----: | ----: | ------: | ------------------- | ---------------- |
| 5 dirty fixture transitions | 0 | 5 | illegal action, shape mismatch, non-finite reward, draw metadata mismatch, non-zero-sum reward | false |

The dirty fixture is intentional. Clean exports must have `invalid=0`; otherwise `--require-clean-dataset` blocks training.

## Remaining Risks

| Risk | Severity | Next Action |
| ---- | -------- | ----------- |
| Broad one-hand EV checks allow terminal result pot echo ambiguity | MEDIUM | Normalize terminal pot snapshots per controller before making chip conservation strict across all variants. |
| Board/Omaha/Stud evaluator replay is not fully checked hand-by-hand | MEDIUM | Add per-family evaluator replay fixtures that compare terminal result winners against evaluator output. |
| Production human logs have not been bulk-audited with this EV guard | MEDIUM | Run exported real hand history through clean dataset validation before Pro/Iron/WorldMaster training. |
| Odd-chip policy is deterministic in fixtures, not yet fully TDA-position based per variant | LOW | Add per-variant odd-chip rules for split-pot games. |

## Verification Commands

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npm run test:game:ev` | PASS | 1 file, 14 tests covering EV-001 through EV-015. |
| `npm run test:game:one-hand` | PASS | 2 files, 53 tests; terminal EV guard did not fail any runnable variant. |
| `npm run test:game:known-bugs` | PASS | 42 regression tests. |
| `npm run test:game:progress` | PASS | 9 files, 151 tests; EV guard integration did not regress progress coverage. |
| `npm run test:rl:safety` | PASS | 8 files, 52 tests; reward corruption fixture is blocked. |
| `npm run test:mgx:safety` | PASS | known-bugs, one-hand, EV, and RL safety gates passed as an aggregate. |
| `npm run test:e2e:progression` | PASS | 7 Playwright progression-guarantee tests passed. |
| `npm run build` | PASS | Production build completed; existing chunk-size/browserslist warnings only. |
