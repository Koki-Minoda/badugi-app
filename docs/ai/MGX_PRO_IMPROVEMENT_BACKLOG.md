# MGX Pro Improvement Backlog

| ID | Variant | Issue | Metric Evidence | Priority | Suggested Fix |
| -- | ------- | ----- | --------------- | -------- | ------------- |
| P4B-001 | D01 | Final-round 2-7 betting still loses too much versus Standard. | Pro `evPerHand: -72.4/-20.6` vs Standard `102.4/50.6`; fallback `0.2510/0.2476` | P0 | Split premium 7-low and clean 8-low value lines from rough 8/9-low bluff-catch lines, especially when facing a bet. |
| P4B-002 | D02 | A-5 post-draw betting remains the largest EV drag. | Pro `evPerHand: -93.4/-96.8` vs Standard `123.4/126.8`; fallback `0.2671/0.2601` | P0 | Separate wheel/6-low/strong 7-low value bets from paired and weak 8/9-low bluff-catch branches. |
| P4B-003 | S01 | Single-draw 2-7 is safer but still under-realizes value. | Pro `evPerHand: -8.2/4.2` vs Standard `38.2/25.8`; fallback `0.2684/0.2606` | P1 | Add one-draw-specific value betting after improved completions while keeping weak finals on check/fold rails. |
| P4B-004 | S02 | Single-draw A-5 no longer spews, but still misses too many profitable bets. | Pro `evPerHand: -7.8/-7.2` vs Standard `37.8/37.2`; fallback `0.2603/0.2497` | P1 | Increase value betting for wheel and clean 6/7-low completions without reintroducing loose raises. |
| P4B-005 | D03 | Badugi fallback coverage is fixed, but medium-strength betting EV is flat. | Pro fallback `0.0000/0.0000`; Pro EV `7.5/7.5` = Standard `7.5/7.5` | P1 | Improve medium made Badugi betting and cheap-call defense so Pro can beat, not just match, Standard. |
| P4B-006 | D01/D02/S01/S02 | Pat thresholds still leak on some completed lows. | Leak analysis shows `bad pat` samples: D01 `32`, D02 `29`, S01 `3`, S02 `5` | P2 | Refine pat/draw boundaries with separate logic for final draw versus pre-final draw streets. |
| P4B-007 | B01/B05/B06/ST1/ST3 | Major 10 board/stud variants are still not in live Pro evaluation. | `NOT_RUN: NEEDS_PRO_RULES` | P1 | Implement executable Pro betting rules and evaluation-compatible routing for board/stud families. |
