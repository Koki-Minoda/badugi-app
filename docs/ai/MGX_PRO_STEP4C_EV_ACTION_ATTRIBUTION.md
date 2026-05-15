# MGX Pro Step4-C EV Action Attribution

Sources:
- `reports/ai-eval/pro-vs-standard-20260506.json`
- `reports/ai-eval/pro-vs-standard-20260507.json`
- `reports/ai-eval/pro-vs-standard-20260508.json`

| Variant | Action Type | Leak Type | Count | EV Impact | Example Trace | Suggested Fix |
|---|---|---|---:|---:|---|---|
| D01 | PAT | PAT too weak | 141 | 7350.0 | 6D 2D 3C 5H KH | Do not lock in rough or paired finals too aggressively; keep weak pat hands on check/fold paths. |
| D01 | DRAW | DRAW bad discard | 96 | 960.0 | 4S 3S 5C 6S 7S | Refine pat/draw thresholds for completed lows and made Badugi hands before the last draw. |
| D01 | CALL | CALL losing call | 143 | 858.0 | standard-fallback | Tighten facing-bet defense for rough lows, paired finals, and weak 3-card Badugi holdings. |
| D01 | CALL/FOLD | facing bet leak | 144 | 720.0 | standard-fallback | Separate premium bluff-catch calls from rough-low folds when facing late action. |
| D01 | FOLD | FOLD missed showdown | 4 | 230.0 | 4D 7C 2C 3H 3S | Keep premium made lows and strong Badugi hands on value/call rails instead of over-folding. |
| D01 | PAT | PAT too passive | 4 | 230.0 | 4D 7C 2C 3H 3S | Increase value betting for smooth completed lows and stronger made Badugi hands after the final draw. |
| D02 | PAT | PAT too weak | 143 | 9460.0 | 2D 3C 5D JH 5H | Do not lock in rough or paired finals too aggressively; keep weak pat hands on check/fold paths. |
| D02 | DRAW | DRAW bad discard | 87 | 870.0 | AH 3S 6S AC 2C | Refine pat/draw thresholds for completed lows and made Badugi hands before the last draw. |
| D02 | CALL | CALL losing call | 144 | 864.0 | standard-fallback | Tighten facing-bet defense for rough lows, paired finals, and weak 3-card Badugi holdings. |
| D02 | CALL/FOLD | facing bet leak | 144 | 720.0 | standard-fallback | Separate premium bluff-catch calls from rough-low folds when facing late action. |
| D02 | FOLD | FOLD missed showdown | 6 | 290.0 | AC 3S 4C 3H AD | Keep premium made lows and strong Badugi hands on value/call rails instead of over-folding. |
| D02 | PAT | PAT too passive | 6 | 290.0 | AC 3S 4C 3H AD | Increase value betting for smooth completed lows and stronger made Badugi hands after the final draw. |
| D03 | BET | BET missed value | 0 | 0.0 | no dominant Step4-C leak sample | Keep tuning medium-strength value realization if EV remains flat versus Standard. |
| S01 | PAT | PAT too weak | 144 | 2690.0 | 6D 2D 3C 8C QH | Do not lock in rough or paired finals too aggressively; keep weak pat hands on check/fold paths. |
| S01 | CALL | CALL losing call | 144 | 864.0 | standard-fallback | Tighten facing-bet defense for rough lows, paired finals, and weak 3-card Badugi holdings. |
| S01 | CALL/FOLD | facing bet leak | 144 | 720.0 | standard-fallback | Separate premium bluff-catch calls from rough-low folds when facing late action. |
| S01 | DRAW | DRAW bad discard | 25 | 250.0 | 8H 7H 5C 7S 5S | Refine pat/draw thresholds for completed lows and made Badugi hands before the last draw. |
| S02 | PAT | PAT too weak | 144 | 2730.0 | 6D 2D 3C 8C 5D | Do not lock in rough or paired finals too aggressively; keep weak pat hands on check/fold paths. |
| S02 | CALL | CALL losing call | 144 | 864.0 | standard-fallback | Tighten facing-bet defense for rough lows, paired finals, and weak 3-card Badugi holdings. |
| S02 | CALL/FOLD | facing bet leak | 144 | 720.0 | standard-fallback | Separate premium bluff-catch calls from rough-low folds when facing late action. |
| S02 | DRAW | DRAW bad discard | 10 | 100.0 | 3S AC 2C 2D 5H | Refine pat/draw thresholds for completed lows and made Badugi hands before the last draw. |
| S02 | FOLD | FOLD missed showdown | 2 | 40.0 | AS 4S 3S 6C AC | Keep premium made lows and strong Badugi hands on value/call rails instead of over-folding. |
| S02 | PAT | PAT too passive | 2 | 40.0 | AS 4S 3S 6C AC | Increase value betting for smooth completed lows and stronger made Badugi hands after the final draw. |
