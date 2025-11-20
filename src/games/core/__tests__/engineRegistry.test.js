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
  });
});
