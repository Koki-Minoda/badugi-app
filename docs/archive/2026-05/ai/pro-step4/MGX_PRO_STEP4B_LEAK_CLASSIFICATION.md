# MGX Pro Step4-B Leak Classification

Source: `reports/ai-eval/pro-vs-standard-20260506.json`

| Variant | Leak Type | Count | EV Impact | Example Hand/Trace | Suggested Fix |
| --- | ---: | ---: | ---: | --- | --- |
| D01 | weak call loss | 47 | 2810.0 | 6D 2D 3C 5H KH | Reduce marginal calls and rough-low defense after the final draw. |
| D01 | missed value bet | 4 | 550.0 | 6S 5H 3D 4S 8D | Separate premium made lows from marginal made lows so value spots still bet/raise. |
| D01 | bad pat | 32 | 320.0 | 4S 3S 5C 6S 7S | Tighten pat thresholds for completed lows and made Badugi hands. |
| D01 | fallback-heavy street | 48 | 240.0 | AS 4S 3S 10S 6C | Cover more betting spots inside the Pro overlay instead of dropping to fallback. |
| D02 | weak call loss | 48 | 3830.0 | 2D 3C 5D JH 5H | Reduce marginal calls and rough-low defense after the final draw. |
| D02 | missed value bet | 4 | 320.0 | AC 3S 4C 3H AD | Separate premium made lows from marginal made lows so value spots still bet/raise. |
| D02 | bad pat | 29 | 290.0 | AH 3S 6S AC 2C | Tighten pat thresholds for completed lows and made Badugi hands. |
| D02 | fallback-heavy street | 48 | 240.0 | AS 4S 3S 10S 6C | Cover more betting spots inside the Pro overlay instead of dropping to fallback. |
| S01 | single-draw over-aggression | 48 | 890.0 | 6D 2D 3C 8C QH | Lower final-round aggression and let marginal one-draw hands check/fold more often. |
| S01 | missed value bet | 2 | 40.0 | 2S 4S 8H 3C 4D | Separate premium made lows from marginal made lows so value spots still bet/raise. |
| S01 | bad pat | 3 | 30.0 | 8H 7H 5C 7S 5S | Tighten pat thresholds for completed lows and made Badugi hands. |
| S01 | fallback-heavy street | 48 | 240.0 | AS 4S 3S 10S 6C | Cover more betting spots inside the Pro overlay instead of dropping to fallback. |
| S02 | single-draw over-aggression | 48 | 860.0 | 6D 2D 3C 8C 5D | Lower final-round aggression and let marginal one-draw hands check/fold more often. |
| S02 | missed value bet | 1 | 20.0 | AS 4S 3S 6C AC | Separate premium made lows from marginal made lows so value spots still bet/raise. |
| S02 | bad pat | 5 | 50.0 | 3S AC 2C 2D 5H | Tighten pat thresholds for completed lows and made Badugi hands. |
| S02 | fallback-heavy street | 48 | 240.0 | AS 4S 3S 10S 6C | Cover more betting spots inside the Pro overlay instead of dropping to fallback. |
