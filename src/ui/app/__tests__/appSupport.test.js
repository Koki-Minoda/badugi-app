import { describe, expect, it } from "vitest";
import { npcAutoDrawCount } from "../aiSupport.js";
import {
  buildSafeControllerBetAction,
  clonePlayerState,
  normalizeControllerLegalActionType,
} from "../gameProgressSupport.js";
import { cloneHandHistory, formatHandIdentifier } from "../historySupport.js";
import {
  getBlindStructureForTournamentConfig,
  normalizeTournamentBlindLevel,
} from "../tournamentSupport.js";

describe("extracted App support boundaries", () => {
  it("keeps controller fallback legal and contribution-based", () => {
    expect(normalizeControllerLegalActionType({ type: "call" })).toBe("CALL");
    expect(buildSafeControllerBetAction({
      legalActions: ["FOLD", { type: "CALL" }],
      currentBet: 80,
      actorBet: 30,
    })).toMatchObject({ type: "CALL", amount: 50 });
    expect(buildSafeControllerBetAction({ legalActions: ["CHECK"] })).toMatchObject({
      type: "CHECK",
      amount: 0,
    });
  });

  it("clones mutable player card collections", () => {
    const player = { hand: ["AS"], cards: ["2C"], selected: [0] };
    const cloned = clonePlayerState(player);
    expect(cloned).toEqual(player);
    expect(cloned.hand).not.toBe(player.hand);
    expect(cloned.cards).not.toBe(player.cards);
    expect(cloned.selected).not.toBe(player.selected);
  });

  it("normalizes tournament blind aliases", () => {
    expect(normalizeTournamentBlindLevel({ smallBlind: 25, bigBlind: 50, hands: 5 }, 1)).toEqual({
      level: 2,
      levelIndex: 2,
      sb: 25,
      bb: 50,
      ante: 0,
      hands: 5,
      handsThisLevel: 5,
    });
    expect(getBlindStructureForTournamentConfig({ levels: [{ sb: 10, bb: 20 }] })[0]).toMatchObject({
      level: 1,
      sb: 10,
      bb: 20,
    });
  });

  it("creates isolated history snapshots and stable identifiers", () => {
    const source = { events: [{ type: "BET" }] };
    const cloned = cloneHandHistory(source);
    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.events).not.toBe(source.events);
    expect(formatHandIdentifier({
      tableId: "Table One",
      handNumber: 7,
      dealerSeat: 2,
      timestamp: 36,
    })).toBe("Table-One-h7-d2-10");
  });

  it("keeps the existing NPC draw heuristic at the AI boundary", () => {
    expect(npcAutoDrawCount({ ranks: [4], kicker: 4 })).toBe(3);
    expect(npcAutoDrawCount({ ranks: [4, 3, 2], kicker: 8 })).toBe(1);
    expect(npcAutoDrawCount({ ranks: [4, 3, 2, 1], kicker: 9 })).toBe(0);
  });
});
