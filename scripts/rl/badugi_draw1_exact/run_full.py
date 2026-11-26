"""Bounded, restart-safe exact enumeration over 16,432 suit representatives."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import threading
import time

HERE = Path(__file__).resolve().parent
INPUT = HERE / "canonical-hands.txt"
EXECUTABLE = HERE / "exact_draw1"
OUTPUT = HERE / "canonical-exact.bin.gz"
PARTIAL = HERE / "canonical-exact.bin.gz.partial"
LOG = HERE / "full-run.log"
assert not OUTPUT.exists() and not PARTIAL.exists(), "Preserve previous run"
assert hashlib.sha256(INPUT.read_bytes()).hexdigest() == "b832d9102f1fcf648719d1d5a58dd1ebe0a350e1b58608995b3410cc97a6605c"
started = time.monotonic()
with INPUT.open("rb") as source, LOG.open("wb") as log, PARTIAL.open("wb") as binary:
    process = subprocess.Popen([str(EXECUTABLE)], stdin=source, stdout=subprocess.PIPE, stderr=log)
    timer = threading.Timer(100, process.kill)
    timer.start()
    try:
        with gzip.GzipFile(filename="", mode="wb", fileobj=binary, mtime=0, compresslevel=6) as compressed:
            while chunk := process.stdout.read(1024 * 1024):
                compressed.write(chunk)
        exit_code = process.wait()
    finally:
        timer.cancel()
assert exit_code == 0, f"Exact enumeration failed: exit={exit_code}, inspect {PARTIAL} and {LOG}"
assert "DONE hands=16432 outcomes=4448553200" in LOG.read_text()
PARTIAL.replace(OUTPUT)
summary = {
    "status": "EXACT_CANONICAL_ONE_DRAW_NOT_EV",
    "sourceCatalogSha256": "1425c2c10b7d98523cc35b64f84adafb6ff107b8a48ba311dd35fb1b18012999",
    "canonicalInputSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
    "sourceCodeSha256": hashlib.sha256((HERE / "exact_draw1.cpp").read_bytes()).hexdigest(),
    "outputSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "canonicalHands": 16432,
    "masksPerHand": 16,
    "exactOutcomes": 4448553200,
    "elapsedSeconds": round(time.monotonic() - started, 3),
    "limits": "Suit-isomorphism canonical cache. Initial four cards excluded after discard. No opponents, betting EV, or three-street policy. Output per representative has all 1092 final-score counts per keep mask."
}
(HERE / "full-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(summary, ensure_ascii=False))
