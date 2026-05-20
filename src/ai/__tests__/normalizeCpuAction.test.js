import { describe, expect, it } from "vitest";

import { normalizeCpuAction } from "../normalizeCpuAction.js";

describe("normalizeCpuAction", () => {
  it("keeps canonical action fields", () => {
    expect(normalizeCpuAction({ action: "raise", amount: 40 }, { legalActions: ["RAISE"] })).toMatchObject({
      action: "raise",
      amount: 40,
      sourceActionField: "action",
      normalized: true,
      valid: true,
      legal: true,
      warnings: [],
    });
  });

  it("accepts legacy type aliases from pro-overlay", () => {
    expect(normalizeCpuAction({ type: "raise" }, { legalActions: ["FOLD", "CALL", "RAISE"] })).toMatchObject({
      action: "raise",
      sourceActionField: "type",
      valid: true,
      legal: true,
    });
  });

  it("maps fixed-limit bet intent to raise when raise is the legal pressure action", () => {
    const normalized = normalizeCpuAction(
      { type: "bet" },
      { legalActions: ["FOLD", "CHECK", "RAISE"], fixedLimit: true, toCall: 0 },
    );

    expect(normalized).toMatchObject({
      action: "raise",
      sourceActionField: "type",
      valid: true,
      legal: true,
    });
    expect(normalized.warnings).toContain("bet-alias-normalized-to-raise");
  });

  it("keeps passive canonical actions", () => {
    expect(normalizeCpuAction({ action: "call" }, { legalActions: ["FOLD", "CALL", "RAISE"] })).toMatchObject({
      action: "call",
      sourceActionField: "action",
      valid: true,
      legal: true,
    });
  });

  it("normalizes draw payloads separately from bet actions", () => {
    expect(
      normalizeCpuAction({ type: "draw", discardIndexes: [0, "2", -1, "x"] }, { legalActions: ["DRAW"] }),
    ).toMatchObject({
      action: "draw",
      drawCount: 2,
      discardIndexes: [0, 2],
      sourceActionField: "type",
      valid: true,
      legal: true,
    });
  });

  it("classifies invalid action values", () => {
    expect(normalizeCpuAction({ type: "jam" }, { legalActions: ["CHECK", "RAISE"] })).toMatchObject({
      action: null,
      sourceActionField: "type",
      valid: false,
      legal: false,
      fallbackReason: "CPU_ACTION_INVALID_AFTER_NORMALIZATION",
    });
  });

  it("classifies normalized actions that remain illegal", () => {
    expect(normalizeCpuAction({ type: "raise" }, { legalActions: ["CHECK", "CALL"] })).toMatchObject({
      action: "raise",
      sourceActionField: "type",
      valid: true,
      legal: false,
      fallbackReason: "CPU_ACTION_ILLEGAL_AFTER_NORMALIZATION",
    });
  });
});
