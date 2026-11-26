"""Build suit-isomorphism representatives from the frozen all-keep catalog."""
import gzip
import hashlib
import itertools
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "d03-entry-keep-catalog-20261126" / "catalog-all-legal.jsonl.gz"
EXPECTED = "1425c2c10b7d98523cc35b64f84adafb6ff107b8a48ba311dd35fb1b18012999"
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED
PERMUTATIONS = tuple(itertools.permutations(range(4)))
reps = set()
rows = 0
with gzip.open(SOURCE, "rt") as stream:
    for line in stream:
        row = json.loads(line)
        hand = row["hand"]
        rep = min(tuple(sorted(4 * r + p[s] for r, s in hand)) for p in PERMUTATIONS)
        reps.add(rep)
        rows += 1
assert rows == 270725
reps = sorted(reps)
assert len(reps) == 16432
out = HERE / "canonical-hands.txt"
if out.exists():
    assert out.read_text() == "".join(" ".join(map(str, r)) + "\n" for r in reps)
else:
    out.write_text("".join(" ".join(map(str, r)) + "\n" for r in reps))
sample = HERE / "benchmark-1000-hands.txt"
chosen = sorted(random.Random(1126).sample(reps, 1000))
if sample.exists():
    assert sample.read_text() == "".join(" ".join(map(str, r)) + "\n" for r in chosen)
else:
    sample.write_text("".join(" ".join(map(str, r)) + "\n" for r in chosen))
print(json.dumps({"sourceSha256": EXPECTED, "initialHands": rows,
                  "canonicalHands": len(reps),
                  "canonicalSha256": hashlib.sha256(out.read_bytes()).hexdigest(),
                  "benchmarkSha256": hashlib.sha256(sample.read_bytes()).hexdigest()}))
