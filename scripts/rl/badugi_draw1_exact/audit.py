"""Independent Python scorer and denominator audit of exact C++ distributions."""
from collections import Counter
from itertools import combinations
from math import comb
from pathlib import Path
import hashlib
import json
import struct

HERE = Path(__file__).resolve().parent
INPUT = HERE / "benchmark-1000.bin"

def score(cards):
    best = (0, ())
    for n in range(1, 5):
        for chosen in combinations(cards, n):
            ranks = [c // 4 for c in chosen]
            suits = [c % 4 for c in chosen]
            if len(set(ranks)) != n or len(set(suits)) != n:
                continue
            key = (n, tuple(13 - r for r in sorted(ranks, reverse=True)))
            if key > best:
                best = key
    n, inverse = best
    code = n
    for i in range(4):
        code = code * 14 + (inverse[i] if i < n else 0)
    return code

with INPUT.open("rb") as stream:
    nkeys, = struct.unpack("<I", stream.read(4))
    keys = struct.unpack(f"<{nkeys}I", stream.read(4 * nkeys))
    assert len(keys) == 1092 and list(keys) == sorted(set(keys))
    rows = []
    for i in range(1000):
        hand = struct.unpack("<4I", stream.read(16))
        counts = struct.unpack(f"<{16*nkeys}I", stream.read(16*nkeys*4))
        assert all(sum(counts[m*nkeys:(m+1)*nkeys]) == comb(48, 4-m.bit_count()) for m in range(16))
        rows.append((hand, counts))
    assert not stream.read(1)

sample_indices = [0, 999]
checked = []
for i in sample_indices:
    hand, counts = rows[i]
    rest = [c for c in range(52) if c not in hand]
    for mask in (0, 1, 3, 7, 15):
        keep = [c for j, c in enumerate(hand) if mask & (1 << j)]
        independent = Counter(score(keep + list(drawn)) for drawn in combinations(rest, 4-len(keep)))
        expected = {key: counts[mask*nkeys+j] for j, key in enumerate(keys) if counts[mask*nkeys+j]}
        assert independent == expected, (i, mask)
        checked.append({"row": i, "hand": hand, "mask": mask, "outcomes": sum(independent.values())})
print(json.dumps({"status": "PASS", "fileSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
                  "scoreKeys": nkeys, "allMasksDenominatorRows": len(rows),
                  "independentCases": checked}, separators=(",", ":")))
