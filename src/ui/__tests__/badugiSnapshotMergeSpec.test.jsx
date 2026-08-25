import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";
import { BadugiUIAdapter } from "../game/badugi/BadugiUIAdapter.js";

const players = [
  { name: "Hero", stack: 500, hand: ["AS", "2H", "3C", "4D"], betThisRound: 0, totalInvested: 20 },
  { name: "Mina", stack: 500, hand: ["2S", "3H", "4C", "5D"], betThisRound: 0, totalInvested: 20 },
  { name: "Ren", stack: 500, hand: ["3S", "4H", "5C", "6D"], betThisRound: 0, totalInvested: 20 },
];

describe("Badugi snapshot merge release spec", () => {
  it("does not allow stale metadata actingPlayerIndex to override canonical turn", () => {
    const merged = mergeEngineSnapshot(
      { players, metadata: { actingPlayerIndex: 0 } },
      {
        players,
        phase: "BET",
        turn: 2,
        nextTurn: 2,
        metadata: { actingPlayerIndex: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(2);
  });

  it("clears acting player when canonical controller state has no actor", () => {
    const merged = mergeEngineSnapshot(
      { players, metadata: { actingPlayerIndex: 0 } },
      {
        players,
        phase: "SHOWDOWN",
        turn: null,
        nextTurn: null,
        metadata: { actingPlayerIndex: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBeNull();
  });

  it("shows hero controls only when hero is canonical actor", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        players,
        phase: "BET",
        turn: 2,
        nextTurn: 2,
        currentBet: 0,
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(props.controlsConfig.heroTurn).toBe(false);
    expect(props.controlsConfig.canCheck).toBe(false);
    expect(props.seatViews[0].isTurn).toBe(false);
    expect(props.seatViews[2].isTurn).toBe(true);
  });

  it("after hero acts, stale metadata cannot keep hero acting on the same street", () => {
    const merged = mergeEngineSnapshot(
      {
        players: players.map((player, seat) => ({
          ...player,
          hasActedThisRound: seat === 0,
          lastAction: seat === 0 ? "Check" : "",
        })),
        metadata: { actingPlayerIndex: 0 },
      },
      {
        players: players.map((player, seat) => ({
          ...player,
          hasActedThisRound: seat === 0,
          lastAction: seat === 0 ? "Check" : "",
        })),
        phase: "BET",
        turn: 1,
        nextTurn: 1,
        metadata: { actingPlayerIndex: 0 },
      },
    );
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        ...merged,
        phase: "BET",
        turn: merged.metadata.actingPlayerIndex,
        nextTurn: merged.metadata.actingPlayerIndex,
        currentBet: 0,
      },
      tableConfig: { bbValue: 10, maxDraws: 3 },
    });

    expect(merged.metadata.actingPlayerIndex).toBe(1);
    expect(props.controlsConfig.heroTurn).toBe(false);
  });
});
