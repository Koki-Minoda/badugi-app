import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { writeIronSourcePriorityAudit } from "../auditIronSourcePriority.js";

describe("writeIronSourcePriorityAudit", () => {
  it("persists audit rows", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "source-priority-"));
    const outputPath = path.join(dir, "audit.json");
    const rows = [{ decisionId: "d1", selectedSource: "verified-neighbor-v3-isolated" }];
    await writeIronSourcePriorityAudit({ rows, outputPath });
    const saved = JSON.parse(await fs.readFile(outputPath, "utf8"));
    expect(saved).toEqual(rows);
  });
});
