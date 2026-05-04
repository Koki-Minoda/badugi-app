import { describe, expect, it } from "vitest";
import { getBlindSeatIndexes, getPositionNameForSeat } from "../positionLabels.js";

const active = (stack = 100) => ({ stack, seatOut: false, isBusted: false });
const out = () => ({ stack: 0, seatOut: true, isBusted: true });

describe("positionLabels", () => {
  it("compresses positions around busted seats", () => {
    const players = [active(1100), active(230), out(), active(1350), active(275), out()];
    expect(getPositionNameForSeat(3, 3, players)).toBe("BTN");
    expect(getPositionNameForSeat(4, 3, players)).toBe("SB");
    expect(getPositionNameForSeat(0, 3, players)).toBe("BB");
    expect(getPositionNameForSeat(1, 3, players)).toBe("UTG");
    expect(getPositionNameForSeat(2, 3, players)).toBe("OUT");
    expect(getPositionNameForSeat(5, 3, players)).toBe("OUT");
    expect(getBlindSeatIndexes(players, 3)).toEqual({ sbIdx: 4, bbIdx: 0 });
  });

  it("labels heads-up button as small blind", () => {
    const players = [active(), out(), out(), active(), out(), out()];
    expect(getPositionNameForSeat(3, 3, players)).toBe("BTN/SB");
    expect(getPositionNameForSeat(0, 3, players)).toBe("BB");
    expect(getBlindSeatIndexes(players, 3)).toEqual({ sbIdx: 3, bbIdx: 0 });
  });

  it("keeps busted seats out even when a stale active flag remains", () => {
    const players = [active(1100), { ...out(), isActiveInGame: true }, active(800)];
    expect(getPositionNameForSeat(1, 2, players)).toBe("OUT");
    expect(getBlindSeatIndexes(players, 2)).toEqual({ sbIdx: 2, bbIdx: 0 });
  });
});
