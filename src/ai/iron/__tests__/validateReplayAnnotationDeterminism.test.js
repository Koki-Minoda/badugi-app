import { describe, expect, it } from "vitest";
import { validateReplayAnnotationDeterminismSummary } from "../validateReplayAnnotationDeterminism.js";

describe("validateReplayAnnotationDeterminismSummary", () => {
  it("passes when annotation uses deterministic replay references", () => {
    expect(
      validateReplayAnnotationDeterminismSummary({
        annotation: { annotations: [{ replayDeterministic: true }] },
        replayDeterminism: {
          deterministic: true,
          mismatchCount: 0,
          invalidReplayCount: 0,
        },
      }),
    ).toMatchObject({ deterministic: true, mismatchCount: 0, invalidReplayCount: 0 });
  });
});

