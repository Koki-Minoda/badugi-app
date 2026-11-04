import { describe, expect, it } from "vitest";
import {
  DEFAULT_CASH_AI_TIER_ID,
  resolveAiTierForGameContext,
  resolveTournamentStageId,
} from "../aiTierContext.js";

describe("ai tier context resolution", () => {
  it.each([
    ["store", "standard"],
    ["local", "pro"],
    ["national", "iron"],
    ["world", "worldmaster"],
  ])("resolves %s tournament stage to %s", (stageId, expectedTierId) => {
    expect(
      resolveAiTierForGameContext({
        mode: "tournament-mtt",
        config: { stageId },
      })?.id,
    ).toBe(expectedTierId);
  });

  it("keeps cash on the friend-alpha standard default", () => {
    expect(resolveAiTierForGameContext({ mode: "cash" })?.id).toBe(
      DEFAULT_CASH_AI_TIER_ID,
    );
  });

  it("allows an explicit Beginner choice for a cash table", () => {
    expect(resolveAiTierForGameContext({ mode: "cash", cashTierId: "beginner" })?.id)
      .toBe("beginner");
    expect(resolveAiTierForGameContext({ mode: "cash", cashTierId: "unknown" })?.id)
      .toBe("standard");
  });

  it("allows Beginner in a custom practice MTT without changing ranked stages", () => {
    expect(resolveAiTierForGameContext({ mode: "tournament-mtt",
      config: { stageId: "store", practiceOnly: true, aiTierId: "beginner" } })?.id)
      .toBe("beginner");
    expect(resolveAiTierForGameContext({ mode: "tournament-mtt",
      config: { stageId: "store", aiTierId: "beginner" } })?.id)
      .toBe("standard");
  });

  it("lets dev tier override take priority over tournament stage resolution", () => {
    expect(
      resolveAiTierForGameContext({
        mode: "tournament-mtt",
        config: { stageId: "world" },
        devTierOverride: "standard",
      })?.id,
    ).toBe("standard");
  });

  it("lets dev tier override take priority over cash default", () => {
    expect(
      resolveAiTierForGameContext({
        mode: "cash",
        devTierOverride: "iron",
      })?.id,
    ).toBe("iron");
  });

  it("derives stageId from tournament config id prefixes and active sessions", () => {
    expect(resolveTournamentStageId({ config: { id: "national-mtt" } })).toBe(
      "national",
    );
    expect(
      resolveTournamentStageId({
        config: { id: "store-mtt" },
        tournamentSession: { stageId: "local" },
      }),
    ).toBe("store");
    expect(
      resolveTournamentStageId({
        config: { id: "unknown-event" },
        tournamentSession: { stageId: "local" },
      }),
    ).toBe("local");
  });
});
