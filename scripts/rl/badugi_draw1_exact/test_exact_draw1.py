"""Small independent all-mask check of the exact one-draw scorer."""
from collections import Counter
from itertools import combinations
from math import comb
from pathlib import Path
import struct
import subprocess
import tempfile

SOURCE = Path(__file__).with_name("exact_draw1.cpp")
HANDS = [(0, 1, 2, 40), (0, 4, 8, 12), (44, 48, 49, 50)]

def independent_score(cards):
    best = (0, ())
    for length in range(1, 5):
        for chosen in combinations(cards, length):
            ranks = [c // 4 for c in chosen]
            suits = [c % 4 for c in chosen]
            if len(set(ranks)) == len(set(suits)) == length:
                key = (length, tuple(13-r for r in sorted(ranks, reverse=True)))
                if key > best:
                    best = key
    length, inverse = best
    code = length
    for i in range(4):
        code = code * 14 + (inverse[i] if i < length else 0)
    return code

def test_exact_distributions():
    with tempfile.TemporaryDirectory() as temporary:
        executable = Path(temporary) / "draw1"
        subprocess.run(["c++", "-O3", "-std=c++17", str(SOURCE), "-o", str(executable)], check=True)
        payload = "".join(" ".join(map(str, hand)) + "\n" for hand in HANDS)
        result = subprocess.run([str(executable)], input=payload.encode(), capture_output=True, check=True)
        data = memoryview(result.stdout)
        key_count, = struct.unpack_from("<I", data, 0)
        keys = struct.unpack_from(f"<{key_count}I", data, 4)
        assert key_count == 1092
        offset = 4 + key_count * 4
        for hand in HANDS:
            observed = struct.unpack_from("<4I", data, offset)
            assert observed == hand
            offset += 16
            counts = struct.unpack_from(f"<{16*key_count}I", data, offset)
            offset += 16 * key_count * 4
            rest = [c for c in range(52) if c not in hand]
            for mask in range(16):
                expected = comb(48, 4-mask.bit_count())
                assert sum(counts[mask*key_count:(mask+1)*key_count]) == expected
            for mask in (0, 1, 3, 7, 15):
                keep = [c for i,c in enumerate(hand) if mask & (1 << i)]
                scores = Counter(independent_score(keep+list(drawn)) for drawn in combinations(rest, 4-len(keep)))
                actual = {key: counts[mask*key_count+i] for i,key in enumerate(keys)
                          if counts[mask*key_count+i]}
                assert scores == actual
        assert offset == len(data)

if __name__ == "__main__":
    test_exact_distributions()
    print("PASS three starting hands, all mask denominators, five full mask histograms per hand")
