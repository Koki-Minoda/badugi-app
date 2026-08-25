import { describe, expect, it, vi } from "vitest";
import {
  resolveCanonicalActionSeat,
  resolveSessionPreferredActor,
  shouldSyncLegacyTurnToController,
} from "../actorSourceOfTruth.js";

const activePlayers = Array.from({ length: 6 }, (_, seat) => ({
  seatIndex: seat,
  name: seat === 0 ? "Hero" : `CPU ${seat}`,
  stack: 600,
  folded: false,
  hasFolded: false,
  allIn: false,
  seatOut: false,
  isBusted: false,
}));

describe("actor source of truth helpers", () => {
  it("prefers the session controller actor over a stale legacy controller actor", () => {
    const sessionController = {
      getUiSnapshot: vi.fn(() => ({
        phase: "BET",
        currentActor: 3,
        turn: 3,
      })),
    };
    const gameController = {
      getSnapshot: vi.fn(() => ({
        phase: "BET",
        currentActor: 0,
        turn: 0,
      })),
    };

    expect(
      resolveSessionPreferredActor({
        sessionController,
        sessionState: { handId: "cash-badugi-opening" },
        gameController,
        preferSession: true,
      }),
    ).toBe(3);
    expect(gameController.getSnapshot).not.toHaveBeenCalled();
  });

  it("falls back to the legacy controller actor when session is not preferred", () => {
    const gameController = {
      getSnapshot: vi.fn(() => ({
        phase: "BET",
        currentActor: 4,
      })),
    };

    expect(
      resolveSessionPreferredActor({
        sessionController: null,
        sessionState: null,
        gameController,
        preferSession: false,
      }),
    ).toBe(4);
  });

  it("uses controllerTurn as the CPU scheduler candidate when legacy turn is stale", () => {
    expect(
      resolveCanonicalActionSeat({
        phase: "BET",
        controllerTurn: 3,
        legacyTurn: 0,
        players: activePlayers,
      }),
    ).toBe(3);
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn: 3,
        legacyTurn: 0,
        players: activePlayers,
      }),
    ).toBe(true);
  });

  it("does not sync to folded, all-in, busted, null, or terminal actors", () => {
    const folded = activePlayers.map((player) => ({ ...player }));
    folded[3].folded = true;
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn: 3,
        legacyTurn: 0,
        players: folded,
      }),
    ).toBe(false);

    const allIn = activePlayers.map((player) => ({ ...player }));
    allIn[3].allIn = true;
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn: 3,
        legacyTurn: 0,
        players: allIn,
      }),
    ).toBe(false);

    const busted = activePlayers.map((player) => ({ ...player }));
    busted[3].isBusted = true;
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn: 3,
        legacyTurn: 0,
        players: busted,
      }),
    ).toBe(false);

    expect(
      shouldSyncLegacyTurnToController({
        phase: "SHOWDOWN",
        controllerTurn: 3,
        legacyTurn: 0,
        players: activePlayers,
      }),
    ).toBe(false);
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn: null,
        legacyTurn: 0,
        players: activePlayers,
      }),
    ).toBe(false);
  });
});
