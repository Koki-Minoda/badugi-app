# MGX EV Source Of Truth

Last updated: 2026-05-06

This document fixes the current EV / reward / pot / stack source rules used by the Priority5 EV integrity guard. The goal is to detect corrupt game results before they enter hand history, feedback, or RL training datasets.

## Source Rules

| Area | Current Source | Should Be Authoritative? | Rule | Notes |
| ---- | -------------- | ------------------------ | ---- | ----- |
| total chips / stack | Controller player stacks plus live pot | Yes | In rake-free hands, starting stack total plus live pot must be explainable by terminal stacks and payouts. | Strict conservation is enabled in focused EV tests; one-hand harness treats live result echoes as warnings to avoid false positives. |
| current pot | Controller snapshot `pot`, `totalPot`, or `pots[]` | Yes | Live pot is authoritative until terminal settlement. | Result objects may echo the settled pot; that is not treated as active chips after hand end. |
| side pots | Result `potDetails[]` / `pots[]` | Yes | Each pot amount must be paid exactly once across its components. | Side-pot eligibility uses `eligibleSeatIndexes` when present. |
| player contribution | Player `totalInvested` / `committed` / bet fields | Supporting | Contribution explains pot formation but is not a replacement for terminal payout validation. | Existing controllers expose different contribution field names. |
| all-in eligibility | Per-pot eligible seats | Yes when present | An all-in player can only win pots for which that seat is eligible. | Missing eligibility is reported as lower-confidence rather than guessed. |
| winner selection | Terminal result payouts | Yes | Winner seats must resolve to active, non-folded players. | Folded, busted, sitting-out, or unknown winners are EV errors. |
| fold win | Terminal result | Yes | Folded players cannot receive showdown/fold-win payouts. | A single remaining active player may win without showdown. |
| showdown win | Evaluator result plus terminal result | Yes in focused fixtures | Evaluator winner consistency is asserted for Badugi, 2-7 low, and A-5 low fixtures. | Full per-variant evaluator replay remains a deeper audit. |
| split pot | Component payouts | Yes | Component payout total must equal the pot amount. | Hi/Lo and badugi/low components are treated independently, then summed. |
| odd chip | Deterministic split helper | Yes | Odd chip goes to the earliest deterministic winner order in test fixtures. | Production odd-chip position rules can be refined per game later. |
| reward | Derived from result / stack delta | Yes | Reward must be finite, zero-sum by default, and consistent with stack delta when seat rewards are supplied. | Shaped rewards must be explicitly marked and may opt out of strict zero-sum checks. |
| hand history result | Terminal controller result | Yes | History should preserve pot, winner, and payout detail needed to reproduce EV validation. | Missing terminal result is warning-only in broad smoke, error in focused EV tests. |
| RL transition reward | Dataset transition fields | Yes | Exported transition rewards must be finite; seat reward maps must agree with stack deltas when present. | Dirty transition summaries set `trainingAllowed=false`. |
| dataset export reward | `validateRlTransition` summary | Yes | Invalid reward transitions are excluded or block clean training. | `--require-clean-dataset` should be used for bulk training logs. |

## Guard Policy

| Policy | Rule |
| ------ | ---- |
| Chip conservation | Error in focused EV fixtures; warning in broad one-hand progression when controllers still echo settled pot. |
| Pot conservation | Error when payout total does not equal result pot total. |
| Winner eligibility | Error for folded, inactive, unknown, or pot-ineligible winners. |
| Duplicate payout | Error when the same seat receives the same pot/component payout twice. |
| Reward consistency | Error for non-finite reward, non-zero-sum terminal reward, or reward/stack-delta mismatch. |
| Dataset training | `TRAINING_ALLOWED=NO` for any invalid transition summary. |

