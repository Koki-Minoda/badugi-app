import { describe, expect, it } from "vitest";
import {
  decisionProvenanceForHistory,
  findCompletedHandHistory,
  modelUsedBySeat,
  sharedModelUsedByHand,
} from "../cpuModelAttribution.js";

const action = (seat, source, modelId, type = "call") => ({
  seat, type, metadata: { decisionSource: source, modelId },
});

describe("actual CPU model attribution", () => {
  it("uses the finalized hand after the active history reference is reset", () => {
    const previous = { handId: "old", seats: [{ actions: [] }] };
    const completed = { handId: "target", seats: [{ actions: [action(1, "policy-router", null)] }] };
    expect(findCompletedHandHistory({ current: null, buffer: [previous, completed], handId: "target" }))
      .toBe(completed);
    expect(findCompletedHandHistory({ current: previous, buffer: [completed], handId: "target" }))
      .toBe(completed);
    expect(findCompletedHandHistory({ current: previous, buffer: [completed], handId: "missing" }))
      .toBeNull();
  });
  it("retains the decision source and model in canonical action history", () => {
    expect(decisionProvenanceForHistory({
      decisionSource: "onnx", modelId: "model-badugi-standard-dqn-v3", tierId: "standard",
    })).toEqual({
      decisionSource: "onnx", modelId: "model-badugi-standard-dqn-v3", tierId: "standard",
    });
    expect(decisionProvenanceForHistory({ drawInfo: {
      decisionSource: "onnx", modelId: "model-badugi-standard-dqn-v3", tierId: "standard",
    } })).toEqual({
      decisionSource: "onnx", modelId: "model-badugi-standard-dqn-v3", tierId: "standard",
    });
  });

  it("does not call Pro overlay, Iron rules or World bootstrap a model decision", () => {
    for (const [tierId, source, modelId] of [
      ["pro", "pro-overlay", "model-badugi-pro-v1"],
      ["iron", "policy-router", "model-badugi-iron-v1"],
      ["worldmaster", "policy-router", "model-badugi-worldmaster-v1"],
    ]) {
      expect(modelUsedBySeat({
        actions: [action(1, source, modelId)], seat: 1, variantId: "D03", tierId,
      })).toBeNull();
    }
  });

  it("attributes an actual ONNX hand while ignoring forced blinds", () => {
    const id = "model-badugi-standard-dqn-v3";
    const actions = [
      action(1, null, null, "blind"),
      action(1, "onnx", id, "call"),
      action(1, "onnx", id, "draw"),
    ];
    expect(modelUsedBySeat({ actions, seat: 1, variantId: "D03", tierId: "standard" })?.id).toBe(id);
  });

  it("withholds a model claim when a decision fell back or was not traced", () => {
    const id = "model-badugi-standard-dqn-v3";
    for (const second of [action(1, "onnx-fallback", null), action(1, null, null)]) {
      expect(modelUsedBySeat({
        actions: [action(1, "onnx", id), second], seat: 1,
        variantId: "D03", tierId: "standard",
      })).toBeNull();
    }
  });

  it("only assigns a hand-wide model when every CPU used the same one", () => {
    const id = "model-badugi-standard-dqn-v3";
    const entry = modelUsedBySeat({ actions: [action(1, "onnx", id)], seat: 1, variantId: "D03", tierId: "standard" });
    expect(sharedModelUsedByHand([entry, entry])?.id).toBe(id);
    expect(sharedModelUsedByHand([entry, null])).toBeNull();
    expect(sharedModelUsedByHand([])).toBeNull();
  });
});
