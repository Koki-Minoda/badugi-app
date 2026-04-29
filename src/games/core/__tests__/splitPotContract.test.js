import { describe, expect, it } from "vitest";
import { getVariantById } from "../../config/variantCatalog.js";
import { resolvePot } from "../potResolver.js";
import { resolveShowdown } from "../showdownResolver.js";
import {
  buildSplitShowdownSummary,
  getPotAwardContract,
  getSpecialDrawContract,
  splitAmountByUnits,
  splitPotByComponents,
} from "../splitPotContract.js";

describe("split pot contract", () => {
  it("defines Badeucey as Badugi low plus 2-7 low halves", () => {
    const contract = getSpecialDrawContract(getVariantById("D04"));

    expect(contract).toMatchObject({
      id: "badeucey",
      evaluatorTag: "split-badugi-27",
      splitMode: "component",
      summaryMode: "componentShowdown",
      oddChipPolicy: "componentOrder",
    });
    expect(contract.components.map((component) => component.id)).toEqual([
      "badugiLow",
      "deuceToSevenLow",
    ]);
  });

  it("defines Badacey as Badugi low plus A-5 low halves", () => {
    const contract = getSpecialDrawContract(getVariantById("S06"));

    expect(contract.id).toBe("badacey");
    expect(contract.components.map((component) => component.evaluator)).toEqual([
      "badugi-low",
      "low-a5",
    ]);
  });

  it("uses deterministic component-order rounding for half-pot splits", () => {
    expect(splitPotByComponents(101, getPotAwardContract(getVariantById("D04")).components)).toEqual([
      expect.objectContaining({ componentId: "badugiLow", amount: 51 }),
      expect.objectContaining({ componentId: "deuceToSevenLow", amount: 50 }),
    ]);
    expect(
      splitAmountByUnits(5, [
        { id: "first", shareUnits: 1 },
        { id: "second", shareUnits: 1 },
        { id: "third", shareUnits: 1 },
      ]).map((entry) => entry.amount),
    ).toEqual([2, 2, 1]);
  });

  it("defines Hidugi high-badugi display without split components", () => {
    const contract = getPotAwardContract(getVariantById("D06"));

    expect(contract).toMatchObject({
      id: "hidugi",
      splitMode: "single",
      display: {
        handLabel: "High Badugi",
      },
    });
    expect(contract.components).toEqual([
      expect.objectContaining({
        id: "badugiHigh",
        comparator: "high-badugi",
      }),
    ]);
  });

  it("defines Archie as pair-or-better high plus 8-or-better A-5 low", () => {
    const contract = getPotAwardContract(getVariantById("D07"));

    expect(contract).toMatchObject({
      id: "archie",
      splitMode: "component",
      display: {
        handLabel: "Archie",
      },
    });
    expect(contract.components).toEqual([
      expect.objectContaining({ id: "archieHigh", qualifier: "pairOrBetter" }),
      expect.objectContaining({ id: "archieLow", qualifier: "eightOrBetter" }),
    ]);
  });

  it("builds component showdown summaries for special draw variants", () => {
    const summary = buildSplitShowdownSummary({
      variant: getVariantById("S05"),
      pot: 101,
      evaluations: [
        { seatIndex: 0, componentId: "badugiLow", rankPrimary: 10 },
        { seatIndex: 1, evaluator: "low-27", rankPrimary: 20 },
      ],
    });

    expect(summary).toMatchObject({
      variantId: "S05",
      contractId: "badeucey",
      splitMode: "component",
      oddChipPolicy: "componentOrder",
    });
    expect(summary.components).toEqual([
      expect.objectContaining({
        id: "badugiLow",
        amount: 51,
        evaluations: [expect.objectContaining({ seatIndex: 0 })],
      }),
      expect.objectContaining({
        id: "deuceToSevenLow",
        amount: 50,
        evaluations: [expect.objectContaining({ seatIndex: 1 })],
      }),
    ]);
  });

  it("exposes the same contract through pot and showdown resolver stubs", () => {
    const variant = getVariantById("D05");

    expect(resolvePot({ variant, players: [], boards: [], evaluations: [], pot: 99 })).toMatchObject({
      variantId: "D05",
      splitMode: "component",
      componentPots: [
        { componentId: "badugiLow", amount: 50 },
        { componentId: "aceToFiveLow", amount: 49 },
      ],
      awards: [],
    });
    expect(resolveShowdown({ variant, players: [], boards: [] })).toMatchObject({
      variantId: "D05",
      splitMode: "component",
      contract: { id: "badacey" },
      evaluations: [],
    });
  });
});
