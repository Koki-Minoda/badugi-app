import { describe, expect, it } from "vitest";

import { defineExpansionGuardrails } from "../defineExpansionGuardrails.js";

describe("defineExpansionGuardrails", () => {
  it("enables all governance guardrails", () => {
    const guardrails = defineExpansionGuardrails();
    expect(guardrails.requireDeterministicReplay).toBe(true);
    expect(guardrails.requireInvalidReplayZero).toBe(true);
    expect(guardrails.requireSameActionNeutrality).toBe(true);
    expect(guardrails.d01TeacherDatasetForbidden).toBe(true);
  });
});
