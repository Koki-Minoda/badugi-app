import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";
import { BadugiUIAdapter } from "../game/badugi/BadugiUIAdapter.js";

const players = [
  { name: "Hero", stack: 520, hand: ["AS", "2H", "3C", "4D"], totalInvested: 20 },
  { name: "Mina", stack: 480, hand: ["KS", "KH", "KC", "KD"], totalInvested: 20 },
  { name: "Ren", stack: 480, hand: ["QS", "QH", "QC", "QD"], totalInvested: 20 },
];

describe("Badugi terminal snapshot merge", () => {
  it("clears stale active actor and controls at terminal result", () => {
    const merged = mergeEngineSnapshot(
      { players, metadata: { actingPlayerIndex: 0 } },
      {
        players,
        phase: "SHOWDOWN",
        turn: null,
        nextTurn: null,
        lastHandResult: {
          totalPot: 60,
          results: [{ seatIndex: 0, payout: 60 }],
        },
        metadata: { actingPlayerIndex: 0 },
      },
    );
    const props = new BadugiUIAdapter({}).buildViewProps({
      controllerSnapshot: {
        ...merged,
        phase: "SHOWDOWN",
        turn: merged.metadata.actingPlayerIndex,
        nextTurn: merged.metadata.actingPlayerIndex,
        lastHandResult: {
          totalPot: 60,
          results: [{ seatIndex: 0, payout: 60 }],
        },
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(merged.metadata.actingPlayerIndex).toBeNull();
    expect(props.controlsConfig.heroTurn).toBe(false);
    expect(props.controlsConfig.canCheck).toBe(false);
    expect(props.controlsConfig.canCall).toBe(false);
    expect(props.controlsConfig.canRaise).toBe(false);
    expect(props.controlsConfig.canDraw).toBe(false);
    expect(props.seatViews.some((seat) => seat.isTurn)).toBe(false);
  });

  it("allows next hand to restore canonical actor and fresh pot after terminal state", () => {
    const merged = mergeEngineSnapshot(
      {
        players,
        phase: "SHOWDOWN",
        metadata: { actingPlayerIndex: null },
      },
      {
        players: players.map((player, seat) => ({
          ...player,
          totalInvested: seat === 1 ? 5 : seat === 2 ? 10 : 0,
          betThisRound: seat === 1 ? 5 : seat === 2 ? 10 : 0,
        })),
        phase: "BET",
        turn: 0,
        nextTurn: 0,
        currentBet: 10,
        metadata: { actingPlayerIndex: null },
      },
    );
    const props = new BadugiUIAdapter({}).buildViewProps({
      controllerSnapshot: {
        ...merged,
        phase: "BET",
        turn: merged.metadata.actingPlayerIndex,
        nextTurn: merged.metadata.actingPlayerIndex,
        currentBet: 10,
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(merged.metadata.actingPlayerIndex).toBe(0);
    expect(props.controlsConfig.heroTurn).toBe(true);
    expect(props.potView.total).toBe(15);
  });
});
