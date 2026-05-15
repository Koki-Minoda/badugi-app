import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readIronMonitorHistory, storeIronMonitorHistory } from "../storeIronMonitorHistory.js";

describe("storeIronMonitorHistory", () => {
  it("appends history entries without overwrite", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-iron-history-"));
    const historyPath = path.join(dir, "iron-monitor-history.jsonl");
    const telemetry = {
      monitoringRunId: "iron-step25",
      drift: { status: "WARN" },
      governance: { hardenedStatus: "PASS", rollingBaseline: { rollingDatasetHitRate: 0.0016 } },
      arena: { results: [{ variant: "S02", datasetHitRate: 0, ironProGap: 1 }] },
      determinism: { deterministic: true, invalidReplayCount: 0 },
    };
    await storeIronMonitorHistory({ telemetry, historyPath });
    await storeIronMonitorHistory({ telemetry, historyPath });
    const entries = await readIronMonitorHistory({ historyPath });
    expect(entries).toHaveLength(2);
  });
});
