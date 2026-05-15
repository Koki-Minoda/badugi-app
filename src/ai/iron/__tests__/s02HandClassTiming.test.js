import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditS02HandClassTiming } from "../auditS02HandClassTiming.js";

describe("auditS02HandClassTiming", () => {
  it("summarizes corpus and arena hand class counts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "s02-handclass-"));
    const corpusPath = path.join(dir, "corpus.jsonl");
    const arenaPath = path.join(dir, "arena.jsonl");
    await fs.writeFile(
      corpusPath,
      `${JSON.stringify({ variantId: "S02", handClass: "strongSDA5" })}\n${JSON.stringify({ variantId: "S02", handClass: "weakSDA5" })}\n`,
      "utf8",
    );
    await fs.writeFile(
      arenaPath,
      `${JSON.stringify({ variant: "S02", handClass: "strongSDA5" })}\n`,
      "utf8",
    );
    const report = await auditS02HandClassTiming({
      corpusPaths: [corpusPath],
      arenaNearMissPath: arenaPath,
      outputPath: path.join(dir, "report.json"),
    });
    expect(report.corpusStrongSDA5).toBe(1);
    expect(report.arenaStrongSDA5).toBe(1);
  });
});
