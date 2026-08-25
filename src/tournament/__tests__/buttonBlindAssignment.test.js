import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  activeSeatIndexes,
  calculateButtonBlindAssignment,
  completeHand,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament button and blind assignment policy", () => {
  it("assigns normal button, SB, and BB for 3+ players", () => {
    const assignment = calculateButtonBlindAssignment({
      activeSeats: [0, 1, 2, 3, 4, 5],
      previousButtonSeat: null,
    });
    expect(assignment).toEqual({
      buttonSeat: 0,
      sbSeat: 1,
      bbSeat: 2,
      policy: "no-dead-button",
    });
  });

  it("uses BTN=SB heads-up policy", () => {
    const assignment = calculateButtonBlindAssignment({
      activeSeats: [0, 3],
      previousButtonSeat: null,
    });
    expect(assignment.buttonSeat).toBe(0);
    expect(assignment.sbSeat).toBe(0);
    expect(assignment.bbSeat).toBe(3);
    expect(assignment.policy).toBe("heads-up-button-is-sb");
  });

  it("skips busted and empty seats when rotating blinds", () => {
    let state = buildTournamentTestFixture("default").state;
    const bustedSeat = state.tables[0].seats[1];
    const bustedPlayerId = bustedSeat.playerId;
    state = completeHand(state, state.tables[0].tableId, [
      { seatIndex: bustedSeat.seatIndex, playerId: bustedSeat.playerId, stack: 0 },
    ]);
    const seats = activeSeatIndexes(state);
    expect(state.players[bustedPlayerId].busted).toBe(true);
    expect(state.players[bustedPlayerId].tableId).toBeNull();
    const assignment = calculateButtonBlindAssignment({
      activeSeats: seats,
      previousButtonSeat: 0,
    });
    expect(seats).toContain(1);
    expect(assignment.buttonSeat).toBe(1);
    expect(assignment.bbSeat).not.toBeNull();
  });
});
