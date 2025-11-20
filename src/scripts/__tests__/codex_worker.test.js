import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadTasks,
  validateResponse,
  ensureUniquePrName,
  buildCommitMetadata,
} from "../../.devtools/codex_worker.js";

describe("codex_worker helpers", () => {
  it("throws when the tasks file is malformed", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-worker-"));
    const badFile = path.join(tmpDir, "bad.yaml");
    await fs.writeFile(badFile, "tasks: [", "utf-8");
    await expect(loadTasks(badFile)).rejects.toThrow(/Failed to parse/i);
  });

  it("rejects empty Codex responses", () => {
    expect(() => validateResponse("   ")).toThrow(/response is empty/i);
  });

  it("detects duplicate PR names", () => {
    const task = { id: "SPEC13-999", title: "Demo" };
    const meta = buildCommitMetadata(task);
    const used = new Set([meta.prName]);
    expect(() => ensureUniquePrName(used, meta.prName)).toThrow(/already used/i);
  });
});
