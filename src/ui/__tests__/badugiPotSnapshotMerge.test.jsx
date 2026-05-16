import { describe, expect, it } from "vitest";
import { BadugiUIAdapter } from "../game/badugi/BadugiUIAdapter.js";

const adapter = new BadugiUIAdapter({});

const basePlayer = (overrides = {}) => ({
  name: overrides.name ?? "Seat",
  stack: overrides.stack ?? 480,
  betThisRound: overrides.betThisRound ?? 0,
  totalInvested: overrides.totalInvested ?? 0,
  hand: overrides.hand ?? ["AS", "2H", "3C", "4D"],
  folded: overrides.folded ?? false,
  seatOut: overrides.seatOut ?? false,
  allIn: overrides.allIn ?? false,
});

describe("Badugi pot snapshot merge", () => {
  it("keeps active-hand pot visible after street bets reset", () => {
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        phase: "BET",
        drawRound: 1,
        turn: 0,
        currentBet: 0,
        pots: [],
        players: [
          basePlayer({ name: "Hero", totalInvested: 20 }),
          basePlayer({ name: "Mina", totalInvested: 20 }),
          basePlayer({ name: "Ren", totalInvested: 20 }),
          basePlayer({ name: "Sora", totalInvested: 20 }),
          basePlayer({ name: "Hana", folded: true }),
          basePlayer({ name: "Jun", folded: true }),
        ],
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(props.potView.total).toBe(80);
  });

  it("prefers explicit controller pots when they are present", () => {
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        phase: "BET",
        drawRound: 1,
        turn: 0,
        pots: [{ amount: 120, eligible: [0, 1] }],
        players: [
          basePlayer({ totalInvested: 20 }),
          basePlayer({ totalInvested: 20 }),
        ],
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(props.potView.total).toBe(120);
  });
});
