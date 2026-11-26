"""Map every ordered catalog hand and each keep bit to a suit-isomorphic cache row."""
import gzip
import hashlib
import itertools
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "d03-entry-keep-catalog-20261126" / "catalog-all-legal.jsonl.gz"
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == "1425c2c10b7d98523cc35b64f84adafb6ff107b8a48ba311dd35fb1b18012999"
canonical = [tuple(map(int, line.split())) for line in (HERE / "canonical-hands.txt").read_text().splitlines()]
index = {h: i for i, h in enumerate(canonical)}
assert len(canonical) == len(index) == 16432
permutations = list(itertools.permutations(range(4)))
output = HERE / "catalog-to-canonical.bin.gz"
assert not output.exists(), "Preserve existing map"
rows = 0
orbit_counts = [0] * len(canonical)
with gzip.open(SOURCE, "rt") as source, output.open("wb") as binary:
    with gzip.GzipFile(filename="", mode="wb", fileobj=binary, mtime=0) as compressed:
        compressed.write(b"D03MAP1" + struct.pack("<II", 270725, 16432))
        for line in source:
            hand = json.loads(line)["hand"]
            # Minimize card ids alone. Including the original index in the
            # minimum would break ties between suit isomorphisms incorrectly.
            p = min(permutations, key=lambda p: tuple(sorted(4*r + p[s] for r, s in hand)))
            transformed = tuple(sorted((4*r + p[s], j) for j, (r, s) in enumerate(hand)))
            rep = tuple(card for card, _ in transformed)
            ci = index[rep]
            positions = [0] * 4
            for pos, (_, original_index) in enumerate(transformed):
                positions[original_index] = pos
            assert sorted(positions) == [0,1,2,3]
            compressed.write(struct.pack("<H4B", ci, *positions))
            orbit_counts[ci] += 1
            rows += 1
assert rows == 270725
assert all(1 <= count <= 24 for count in orbit_counts)
summary = {"status":"PASS_ALL_ORIGINAL_HANDS_MAPPED", "rows": rows,
           "canonicalRows":len(canonical), "orbitSizeCounts":{str(n):orbit_counts.count(n) for n in sorted(set(orbit_counts))},
           "mappingSha256":hashlib.sha256(output.read_bytes()).hexdigest(),
           "sourceCatalogSha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
           "format":"D03MAP1 + uint32 originalRows + uint32 canonicalRows; per original catalog line: uint16 representative index, 4 uint8 original-card-index to representative-card-index permutation. Original keep mask maps by permuting its four bits."}
(HERE / "mapping-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2)+"\n")
print(json.dumps(summary))
