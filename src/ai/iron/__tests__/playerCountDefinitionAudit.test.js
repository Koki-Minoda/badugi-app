import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { auditPlayerCountDefinitions } from "../auditPlayerCountDefinitions.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
});

describe("playerCount definition audit", () => {
  it("compares corpus, arena, and reconciled counts", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "playercount-audit-"));
    tempDirs.push(tempDir);
    const corpusPath = path.join(tempDir, "corpus.jsonl");
    const arenaPath = path.join(tempDir, "arena.json");
    const tracePath = path.join(tempDir, "trace.jsonl");
    await fs.writeFile(
      corpusPath,
      `${JSON.stringify({ playerCount: 3 })}\n${JSON.stringify({ playerCount: 3 })}\n`,
      "utf8",
    );
    await fs.writeFile(
      arenaPath,
      JSON.stringify({
        playerCountArena: { 6: 10 },
        playerCountReconciled: { 3: 10 },
        activePlayersAtHandStart: { 6: 10 },
        activePlayersAtDecision: { 6: 10 },
        strongSDA5ByPlayerCount: { "3way": 2 },
        strongSDA5ByArenaPlayerCount: { "4way+": 2 },
      }),
      "utf8",
    );
    await fs.writeFile(tracePath, `${JSON.stringify({ decisionId: "demo" })}\n`, "utf8");
    const { report } = await auditPlayerCountDefinitions({
      corpusPaths: [corpusPath],
      arenaOpportunityPath: arenaPath,
      decisionTracePath: tracePath,
      outputPath: path.join(tempDir, "audit.json"),
    });
    expect(report.divergenceSummary.corpusThreeWayCount).toBe(2);
    expect(report.divergenceSummary.arenaThreeWayCount).toBe(0);
    expect(report.divergenceSummary.reconciledThreeWayCount).toBe(10);
  });
});
