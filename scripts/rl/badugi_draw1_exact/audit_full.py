"""Audit every exact histogram and independent noncanonical original hands."""
from collections import Counter
from itertools import combinations
from math import comb
from pathlib import Path
import gzip
import hashlib
import json
import struct

HERE = Path(__file__).resolve().parent
FULL = HERE / "canonical-exact.bin.gz"
MAPPING = HERE / "catalog-to-canonical.bin.gz"
SOURCE = HERE.parent / "d03-entry-keep-catalog-20261126" / "catalog-all-legal.jsonl.gz"
CANONICAL = [tuple(map(int, line.split())) for line in (HERE / "canonical-hands.txt").read_text().splitlines()]

def score(cards):
    best = (0, ())
    for n in range(1, 5):
        for chosen in combinations(cards, n):
            ranks = [c // 4 for c in chosen]
            suits = [c % 4 for c in chosen]
            if len(set(ranks)) == len(set(suits)) == n:
                key = (n, tuple(13-r for r in sorted(ranks, reverse=True)))
                if key > best:
                    best = key
    n, ranks = best
    code = n
    for i in range(4):
        code = 14*code + (ranks[i] if i < n else 0)
    return code

selected_catalog_indices = {0, 1, 12345, 135362, 270724}
with gzip.open(MAPPING, "rb") as stream:
    assert stream.read(7) == b"D03MAP1"
    original_count, canonical_count = struct.unpack("<II", stream.read(8))
    assert original_count == 270725 and canonical_count == 16432
    mapping = [struct.unpack("<H4B", stream.read(6)) for _ in range(original_count)]
    assert not stream.read(1)
chosen_canonical = {mapping[i][0] for i in selected_catalog_indices}

all_denominators = 0
selected_histograms = {}
with gzip.open(FULL, "rb") as stream:
    key_count, = struct.unpack("<I", stream.read(4))
    keys = struct.unpack(f"<{key_count}I", stream.read(4*key_count))
    assert key_count == 1092 and keys == tuple(sorted(set(keys)))
    for index, expected_hand in enumerate(CANONICAL):
        hand = struct.unpack("<4I", stream.read(16))
        assert hand == expected_hand, (index, hand, expected_hand)
        data = stream.read(16*key_count*4)
        assert len(data) == 16*key_count*4
        counts = struct.unpack(f"<{16*key_count}I", data)
        for mask in range(16):
            assert sum(counts[mask*key_count:(mask+1)*key_count]) == comb(48, 4-mask.bit_count()), (index, mask)
            all_denominators += 1
        if index in chosen_canonical:
            selected_histograms[index] = counts
    assert not stream.read(1)

checked = []
with gzip.open(SOURCE, "rt") as stream:
    for i, line in enumerate(stream):
        if i not in selected_catalog_indices:
            continue
        row = json.loads(line)
        cards = [4*r+s for r,s in row["hand"]]
        canonical_index, *positions = mapping[i]
        histogram = selected_histograms[canonical_index]
        remaining = [c for c in range(52) if c not in cards]
        for mask in (0, 1, 3, 7, 15):
            keep = [c for j,c in enumerate(cards) if mask & (1<<j)]
            mapped_mask = sum(1 << positions[j] for j in range(4) if mask & (1<<j))
            independent = Counter(score(keep+list(drawn)) for drawn in combinations(remaining, 4-len(keep)))
            expected = {key:histogram[mapped_mask*key_count+j] for j,key in enumerate(keys)
                        if histogram[mapped_mask*key_count+j]}
            assert independent == expected, (i, mask, mapped_mask)
            checked.append({"catalogIndex":i,"canonicalIndex":canonical_index,
                            "originalMask":mask,"canonicalMask":mapped_mask,
                            "outcomes":sum(independent.values())})
assert len(checked) == len(selected_catalog_indices)*5
summary = {"status":"PASS_FULL_EXACT_AND_ORIGINAL_MAPPING", "canonicalRows":len(CANONICAL),
           "allMaskDenominatorChecks":all_denominators,"independentOriginalCases":checked,
           "fullOutputSha256":hashlib.sha256(FULL.read_bytes()).hexdigest(),
           "mappingSha256":hashlib.sha256(MAPPING.read_bytes()).hexdigest()}
(HERE / "full-audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2)+"\n")
print(json.dumps({"status":summary["status"],"canonicalRows":summary["canonicalRows"],
                  "allMaskDenominatorChecks":all_denominators,"independentOriginalCases":len(checked),
                  "fullAuditSha256":hashlib.sha256((HERE / "full-audit.json").read_bytes()).hexdigest()}))
