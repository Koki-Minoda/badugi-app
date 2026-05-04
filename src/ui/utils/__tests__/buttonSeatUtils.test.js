import { describe, expect, it, vi } from "vitest";
import {
  initializeButtonForFirstHand,
  isPlayerActiveInGame,
  isPlayerSeated,
  nextAliveSeat,
} from "../buttonSeatUtils.js";

describe("buttonSeatUtils", () => {
  describe("isPlayerSeated", () => {
    it("does not let stale seated flags override busted/seatOut status", () => {
      expect(isPlayerSeated({ isSeated: true, seatOut: true })).toBe(false);
      expect(isPlayerSeated({ isSeated: true, isBusted: true })).toBe(false);
      expect(isPlayerSeated({ isSeated: false, seatOut: false })).toBe(false);
    });

    it("falls back to seatOut / seatType checks", () => {
      expect(isPlayerSeated({ seatOut: false })).toBe(true);
      expect(isPlayerSeated({ seatOut: true })).toBe(false);
      expect(isPlayerSeated({ seatType: "EMPTY" })).toBe(false);
    });
  });

  describe("isPlayerActiveInGame", () => {
    it("does not let stale active flags override busted/seatOut status", () => {
      expect(isPlayerActiveInGame({ isActiveInGame: true, seatOut: true })).toBe(false);
      expect(isPlayerActiveInGame({ isActiveInGame: true, isBusted: true })).toBe(false);
      expect(isPlayerActiveInGame({ isActiveInGame: false, seatOut: false })).toBe(false);
    });

    it("treats busted or seatOut players as inactive", () => {
      expect(isPlayerActiveInGame({ seatOut: true })).toBe(false);
      expect(isPlayerActiveInGame({ isBusted: true })).toBe(false);
    });

    it("requires a positive stack when stack value is provided", () => {
      expect(isPlayerActiveInGame({ stack: 100, seatOut: false })).toBe(true);
      expect(isPlayerActiveInGame({ stack: 0, seatOut: false })).toBe(false);
    });
  });

  describe("initializeButtonForFirstHand", () => {
    it("selects a seat uniformly from eligible players", () => {
      const players = [
        { id: "p1", seatOut: false, stack: 500 },
        { id: "p2", seatOut: false, stack: 500 },
        { id: "p3", seatOut: true, stack: 0 },
        { id: "p4", isSeated: true, isActiveInGame: true },
      ];
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.8);
      const seat = initializeButtonForFirstHand(players);
      expect(seat).toBe(3); // eligible seats [0,1,3] -> index 2 => seat 3
      spy.mockRestore();
    });

    it("throws when fewer than two eligible players exist", () => {
      expect(() => initializeButtonForFirstHand([{ seatOut: false, stack: 100 }])).toThrow(
        "Not enough active seated players to start the game.",
      );
    });
  });

  describe("nextAliveSeat", () => {
    const samplePlayers = [
      { name: "Seat0", seatOut: false, stack: 100 },
      { name: "Seat1", seatOut: true, stack: 0 },
      { name: "Seat2", seatOut: false, stack: 100 },
      { name: "Seat3", seatOut: false, stack: 0 },
    ];

    it("returns the next active seat skipping busted players", () => {
      expect(nextAliveSeat(samplePlayers, 0)).toBe(2);
    });

    it("wraps around the table", () => {
      expect(nextAliveSeat(samplePlayers, 2)).toBe(0);
    });

    it("returns null when no players are eligible", () => {
      expect(
        nextAliveSeat(
          [{ seatOut: true }, { seatType: "EMPTY" }, { stack: 0, seatOut: false }],
          0,
        ),
      ).toBeNull();
    });
  });
});
