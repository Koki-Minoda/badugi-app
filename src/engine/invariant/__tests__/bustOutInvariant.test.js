import { describe, expect, it } from "vitest";
import { assertBustOutInvariant } from "../assertBustOutInvariant.js";

describe("bust out invariant", () => {
  it("flags busted actor selection", () => {
    expect(assertBustOutInvariant({ bustedActorSelected: 1 })[0].type).toBe("BUSTED_ACTOR_SELECTED");
  });

  it("passes safe hero and CPU bust paths", () => {
    expect(
      assertBustOutInvariant({
        heroBustExpected: true,
        heroBustSafe: true,
        cpuBustExpected: true,
        cpuBustSafe: true,
      }),
    ).toEqual([]);
  });
});

