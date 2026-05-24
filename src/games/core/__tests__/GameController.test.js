import { describe, expect, it } from "vitest";
import { GameController } from "../GameController.js";

describe("GameController base class", () => {
  it("getSnapshot() returns null by default", () => {
    expect(new GameController().getSnapshot()).toBeNull();
  });
});
