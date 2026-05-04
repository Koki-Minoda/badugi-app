import { describe, expect, it } from "vitest";
import { ensurePLOUIAdapterRegistered } from "../registerPLOUIAdapter.js";
import { getGameUIAdapter } from "../../GameUIAdapterRegistry.js";
import { APP_VARIANT_IDS } from "../../appVariantRouting.js";

describe("PLOUIAdapter registration", () => {
  it("registers PLO adapter under the PLO app variant id", () => {
    const adapter = ensurePLOUIAdapterRegistered({ force: true });

    expect(getGameUIAdapter(APP_VARIANT_IDS.PLO)).toBe(adapter);
    expect(adapter.formatStreetLabel("FLOP")).toBe("Flop");
  });
});
