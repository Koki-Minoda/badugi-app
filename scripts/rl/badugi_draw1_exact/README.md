# D03 exact one-draw score distributions

This is M1 mathematics for the position-aware Badugi entry-range study (#479,
related #476). It computes **score probabilities after one draw** for all 16
legal keep masks of all 270,725 four-card starting hands. It does not measure
betting EV, opponent ranges, a three-street draw policy, or model strength.

The input is the frozen `catalog-all-legal.jsonl.gz` from the M1 artifact.
The scripts expect a private output directory that is a sibling of that catalog
directory, such as `MGX-RL-Artifacts/d03-entry-draw1-exact-20261126`. Copy
the source files there, then run:

```sh
python3 prepare.py
c++ -O3 -std=c++17 exact_draw1.cpp -o exact_draw1
./exact_draw1 < benchmark-1000-hands.txt > benchmark-1000.bin 2> benchmark-1000.log
python3 audit.py
python3 run_full.py
python3 map_catalog.py
python3 audit_full.py
```

`run_full.py` has a 100-second process limit and refuses to overwrite its
output. A failed run remains as `.partial`; diagnose it before a new attempt.
The original 270,725 hands have 73,292,025,625 possible `(keep, draw)` final
hands. Permuting the four suit names leaves 16,432 canonical initial hands,
which require 4,448,553,200 exact outcomes. Rank identity and all 16 keep
choices stay distinct. The original four cards are excluded from the 48-card
draw deck, including discarded cards.

`canonical-exact.bin.gz` decompresses to little-endian binary:

1. `uint32 scoreKeyCount` (1,092), then that many `uint32` score codes.
2. For each canonical hand in `canonical-hands.txt` order: four `uint32`
   ascending card ids, then 16 consecutive arrays of `scoreKeyCount` `uint32`
   outcome counts. Card id is `rank * 4 + suit`, with rank A=0 through K=12.
   A score code is the valid-card count followed by four base-14 digits,
   `13 - rank` from highest valid rank downward and zero padding.
3. Mask bit `i` means retain initial card `i`; mask 0 draws four and mask 15
   is PAT. Divide each count by `C(48, 4-popcount(mask))` for a probability.

`catalog-to-canonical.bin.gz` maps every original catalog line to a canonical
row and a four-position permutation. See `mapping-summary.json` for its
binary format. To query an original hand, permute its keep-mask bits through
the stored positions before reading the canonical histogram.

The local 2026-11-26 run completed in 43.389 seconds for the full cache and
2.384 seconds for the 1,000-representative benchmark, with about 7.1 MB
maximum RSS for the C++ process. `audit_full.py` checked all 262,912
canonical-hand/mask denominators and recomputed 25 original-hand/mask
histograms using an independent Python scorer. Full output SHA256:
`7e3006d848c91b9ddc080fe79473722c9d5cd28f9e4cd60d792674a14a8e457c`.
Mapping SHA256:
`aa1f11b52cfe0bc6ad4d873e19c5b91b61e35b7adb0fb0ff7b8ca2bc756b0023`.
The large binaries stay in the local artifact directory; the reviewable source
and small test are in this PR.
