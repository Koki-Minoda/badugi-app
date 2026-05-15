import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeArenaDecisionTimingTrace } from "../traceArenaDecisionTiming.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
});

describe("arena decision timing trace", () => {
  it("writes replay-vs-arena timing fields", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arena-timing-trace-"));
    tempDirs.push(tempDir);
    const outputPath = path.join(tempDir, "trace.jsonl");
    await writeArenaDecisionTimingTrace({
      profiles: [
        {
          decisionId: "demo",
          variant: "S02",
          handClass: "strongSDA5",
          playerCountArena: 6,
          playerCountReconciled: 3,
          activePlayersAtHandStart: 6,
          activePlayersAtDecision: 6,
          activeNonFoldedPlayers: 6,
          activeNonAllInPlayers: 6,
          bettingParticipantsCount: 3,
          potContributorsCount: 3,
          foldedPlayers: [],
          allInPlayers: [],
          exactOpportunity: false,
          mismatchReason: "PLAYERCOUNT_MISMATCH",
        },
      ],
      outputPath,
    });
    const written = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(written.trim());
    expect(parsed.playerCountCorpus).toBe(3);
    expect(parsed.playerCountArena).toBe(6);
    expect(parsed.decisionTimingReason).toBe("PLAYERCOUNT_MISMATCH");
  });
});
