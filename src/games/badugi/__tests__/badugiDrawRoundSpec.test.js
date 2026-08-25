import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const hands = [
  ["AS", "2H", "3C", "4D"],
  ["2S", "3H", "4C", "5D"],
  ["3S", "4H", "5C", "6D"],
  ["4S", "5H", "6C", "7D"],
];

function createController() {
  return new BadugiGameController({
    numSeats: 4,
    seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
    startingStack: 500,
    blindStructure: blinds,
    lastStructureIndex: 0,
  });
}

describe("Badugi draw round spec", () => {
  it("allows each active player to discard zero to four cards", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    state = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        drawRound: 0,
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player) => ({
          ...player,
          hasDrawn: false,
          hasActedThisRound: false,
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const pat = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "draw", drawIndexes: [], handAfter: hands[0] },
    });
    expect(pat.events.some((event) => event.type === "invalidAction")).toBe(false);
    expect(pat.state.snapshot.players[0].lastDrawCount).toBe(0);

    const drawFour = controller.applyAction(pat.state, {
      seatIndex: pat.state.snapshot.nextTurn,
      payload: {
        type: "draw",
        drawIndexes: [0, 1, 2, 3],
        handAfter: hands[1],
      },
    });
    expect(drawFour.events.some((event) => event.type === "invalidAction")).toBe(false);
    expect(drawFour.state.snapshot.players[1].lastDrawCount).toBe(4);
  });

  it("skips folded players and advances to the next draw when the betting round is empty", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    state = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        drawRound: 0,
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          folded: seat > 0,
          hasFolded: seat > 0,
          hasDrawn: false,
          hasActedThisRound: seat > 0,
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "draw", drawIndexes: [0], handAfter: hands[0] },
    });

    expect(result.events.some((event) => event.type === "drawRoundComplete")).toBe(true);
    expect(result.state.snapshot.phase).toBe("DRAW");
    expect(result.state.snapshot.drawRound).toBe(1);
  });

  it("moves directly to showdown after final draw when the betting round is empty", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    state = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        drawRound: 2,
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          folded: seat > 0,
          hasFolded: seat > 0,
          hasDrawn: false,
          hasActedThisRound: seat > 0,
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "draw", drawIndexes: [], handAfter: hands[0] },
    });

    expect(result.state.snapshot.phase).toBe("SHOWDOWN");
    expect(result.state.snapshot.drawRound).toBe(3);
  });
});
