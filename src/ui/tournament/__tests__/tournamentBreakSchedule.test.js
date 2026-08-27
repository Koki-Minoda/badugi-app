import { describe, expect, it } from "vitest";
import { buildTournamentConfigFromStage } from "../../../config/tournamentStages.js";
import {
  createMTTSaveSnapshot,
  formatTournamentBreakLabel,
  shouldStartTournamentBreak,
} from "../tournamentManager.js";

describe("tournament break schedule", () => {
  it.each([
    ["store", 0, "L6後 · 5分", 6],
    ["local", 0, "L5後 · 7分", 5],
    ["national", 4, "L8後 · 10分", 4],
    ["world", 3, "L6後 · 12分", 3],
  ])("uses the %s production break cadence", (stageId, levelIndex, label, completedLevel) => {
    const config = buildTournamentConfigFromStage(stageId);
    expect(formatTournamentBreakLabel(config, levelIndex)).toBe(label);
    expect(shouldStartTournamentBreak(config, completedLevel)).toBe(true);
    expect(shouldStartTournamentBreak(config, completedLevel - 1)).toBe(false);
  });

  it("persists an active break in the resumable local snapshot", () => {
    const breakState = { afterLevel: 5, durationMinutes: 7, endsAt: Date.now() + 60_000 };
    const snapshot = createMTTSaveSnapshot({
      tournamentState: {
        config: { stageId: "local", gameVariant: "badugi" },
        players: { hero: { id: "hero", name: "Hero", stack: 800 } },
        tables: [],
      },
      heroPlayerId: "hero",
      hud: { breakState, nextBreakLabel: "L5後 · 7分" },
    });

    expect(snapshot.hud).toMatchObject({
      breakState,
      nextBreakLabel: "L5後 · 7分",
    });
  });
});
