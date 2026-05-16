import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";
import { BadugiUIAdapter } from "../game/badugi/BadugiUIAdapter.js";

const matchedPlayers = [
  {
    name: "Hero",
    stack: 460,
    hand: ["AS", "2H", "3C", "4D"],
    betThisRound: 40,
    totalInvested: 40,
    hasActedThisRound: true,
  },
  {
    name: "Mina",
    stack: 460,
    hand: ["KS", "KH", "KC", "KD"],
    betThisRound: 40,
    totalInvested: 40,
    hasActedThisRound: true,
  },
  {
    name: "Ren",
    stack: 460,
    hand: ["QS", "QH", "QC", "QD"],
    betThisRound: 40,
    totalInvested: 40,
    hasActedThisRound: true,
  },
];

function buildProps(snapshot) {
  return new BadugiUIAdapter({}).buildViewProps({
    controllerSnapshot: snapshot,
    tableConfig: { bbValue: 20, maxDraws: 3 },
  });
}

describe("Badugi raise/call closure snapshot merge", () => {
  it("does not show hero controls when a stale hero actor survives a matched betting round", () => {
    const props = buildProps({
      players: matchedPlayers,
      phase: "BET",
      currentBet: 40,
      turn: 0,
      nextTurn: 0,
      metadata: { actingPlayerIndex: 0 },
    });

    expect(props.controlsConfig.heroTurn).toBe(false);
    expect(props.controlsConfig.canFold).toBe(false);
    expect(props.controlsConfig.canCall).toBe(false);
    expect(props.controlsConfig.canRaise).toBe(false);
  });

  it("lets a pending caller act when stale hero metadata points to the raiser", () => {
    const merged = mergeEngineSnapshot(
      { players: matchedPlayers, metadata: { actingPlayerIndex: 0 } },
      {
        players: [
          matchedPlayers[0],
          {
            ...matchedPlayers[1],
            betThisRound: 20,
            totalInvested: 20,
            hasActedThisRound: false,
          },
          matchedPlayers[2],
        ],
        phase: "BET",
        currentBet: 40,
        turn: 1,
        nextTurn: 1,
        metadata: { actingPlayerIndex: 0 },
      },
    );
    const props = buildProps({
      ...merged,
      phase: "BET",
      currentBet: 40,
      turn: merged.metadata.actingPlayerIndex,
      nextTurn: merged.metadata.actingPlayerIndex,
    });

    expect(merged.metadata.actingPlayerIndex).toBe(1);
    expect(props.controlsConfig.heroTurn).toBe(false);
    expect(props.seatViews[1].isTurn).toBe(true);
  });

  it("hides betting controls after the snapshot has transitioned to DRAW", () => {
    const merged = mergeEngineSnapshot(
      { players: matchedPlayers, metadata: { actingPlayerIndex: 0 } },
      {
        players: matchedPlayers.map((player) => ({
          ...player,
          betThisRound: 0,
          hasActedThisRound: false,
        })),
        phase: "DRAW",
        currentBet: 0,
        turn: 1,
        nextTurn: 1,
        metadata: { actingPlayerIndex: 0 },
      },
    );
    const props = buildProps({
      ...merged,
      phase: "DRAW",
      turn: merged.metadata.actingPlayerIndex,
      nextTurn: merged.metadata.actingPlayerIndex,
    });

    expect(props.controlsConfig.canFold).toBe(false);
    expect(props.controlsConfig.canCall).toBe(false);
    expect(props.controlsConfig.canRaise).toBe(false);
  });
});
