import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHumanBenchmarkLog,
  getHumanBenchmarkLogs,
  saveRLHandHistory,
} from "../history_rl.js";

describe("human benchmark hand logs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a Badugi human benchmark record with hero result and CPU model metadata", () => {
    const log = buildHumanBenchmarkLog({
      handId: "D03-H001",
      ts: 123,
      variantId: "D03",
      variantName: "Badugi",
      tableId: "cash-1",
      tableSize: 2,
      players: [
        { seat: 0, name: "You", startStack: 500, endStack: 540 },
        {
          seat: 1,
          name: "CPU 2",
          startStack: 500,
          endStack: 460,
          isCPU: true,
          cpuTier: "pro",
          cpuModelId: "model-badugi-pro-v1",
          cpuModelVersion: "v2",
          featureSet: "badugi-observation-v1-ev-range",
          trainingRun: "badugi_sixmax_open_spot_20k_20260502",
        },
      ],
      actions: [{ seat: 0, type: "call", amount: 10 }],
      winners: ["You"],
      pot: 80,
    });

    expect(log).toMatchObject({
      schemaVersion: "human-benchmark-v1",
      source: "cash-game",
      handId: "D03-H001",
      heroSeat: 0,
      heroNet: 40,
      heroResult: "win",
      cpuTier: "pro",
      cpuModelId: "model-badugi-pro-v1",
      cpuModelVersion: "v2",
      featureSet: "badugi-observation-v1-ev-range",
    });
    expect(log.opponents[0]).toMatchObject({
      seat: 1,
      net: -40,
      trainingRun: "badugi_sixmax_open_spot_20k_20260502",
    });
    expect(log.actions).toHaveLength(1);
  });

  it("appends a human benchmark log when RL history saves a Badugi hand", () => {
    saveRLHandHistory({
      handId: "D03-H002",
      variantId: "badugi",
      players: [
        { seat: 0, name: "You", startStack: 500, endStack: 480 },
        { seat: 1, name: "CPU 2", startStack: 500, endStack: 520, cpuModelId: "model-badugi-pro-v1" },
      ],
      pot: 40,
    });

    const logs = getHumanBenchmarkLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      handId: "D03-H002",
      heroNet: -20,
      heroResult: "loss",
      cpuModelId: "model-badugi-pro-v1",
    });
  });

  it("does not append human benchmark logs for non-Badugi variants", () => {
    saveRLHandHistory({
      handId: "D01-H001",
      variantId: "D01",
      players: [
        { seat: 0, name: "You", startStack: 500, endStack: 520 },
        { seat: 1, name: "CPU 2", startStack: 500, endStack: 480 },
      ],
    });

    expect(getHumanBenchmarkLogs()).toHaveLength(0);
  });
});
