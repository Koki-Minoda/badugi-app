import { describe, expect, it } from "vitest";
import { getEngine, listEngines } from "../../core/engineRegistry.js";

describe("engineRegistry", () => {
  it("returns badugi engine by default", () => {
    const engine = getEngine("badugi");
    expect(engine).toBeTruthy();
    expect(engine.id).toBe("badugi");
  });

  it("lists registered engines", () => {
    const engines = listEngines();
    expect(engines).toContain("badugi");
    expect(engines).toContain("deuce_to_seven_triple_draw");
  });

  it("returns D01 2-7 Triple Draw engine", () => {
    const engine = getEngine("deuce_to_seven_triple_draw");
    expect(engine).toBeTruthy();
    expect(engine.id).toBe("deuce_to_seven_triple_draw");
    expect(engine.variantId).toBe("D01");
  });
});
