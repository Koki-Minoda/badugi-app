import { describe, expect, it } from "vitest";

import { auditHandReplayFidelity, replayHandFromHistory } from "../handReplay.js";

describe("replayHandFromHistory", () => {
  it("reconstructs the exact action ledger, chips, pot, and draw cards", () => {
    const history = {
      replaySchemaVersion: 2,
      handId: "replay-exact-1",
      seats: [
        {
          seat: 0,
          name: "Hero",
          startStack: 500,
          endStack: 520,
          initialHand: ["AS", "2D", "3C", "KH"],
          actions: [
            { seq: 1, street: "BET", type: "call", amount: 10, totalInvested: 20 },
            {
              seq: 3,
              street: "DRAW",
              type: "draw",
              amount: 0,
              totalInvested: 20,
              drawCount: 1,
              discarded: [3],
              metadata: {
                drawInfo: {
                  before: ["AS", "2D", "3C", "KH"],
                  after: ["AS", "2D", "3C", "4H"],
                  replacedCards: [{ index: 3, oldCard: "KH", newCard: "4H" }],
                },
              },
            },
          ],
        },
        {
          seat: 1,
          name: "Villain",
          startStack: 500,
          endStack: 480,
          initialHand: ["5S", "6D", "7C", "8H"],
          actions: [
            { seq: 2, street: "BET", type: "check", amount: 0, totalInvested: 20 },
          ],
        },
      ],
      events: [
        { type: "HAND_START" },
        { type: "BLINDS_POSTED", sbSeat: 0, sbAmount: 10, bbSeat: 1, bbAmount: 20 },
        {
          type: "BET_ACTION",
          seat: 0,
          action: "call",
          actionSeq: 1,
          amount: 10,
          stackBefore: 490,
          stackAfter: 480,
          betBefore: 10,
          betAfter: 20,
          potAfter: 40,
        },
        {
          type: "BET_ACTION",
          seat: 1,
          action: "check",
          actionSeq: 2,
          amount: 0,
          stackBefore: 480,
          stackAfter: 480,
          betBefore: 20,
          betAfter: 20,
          potAfter: 40,
        },
        { type: "PHASE_TRANSITION", from: "BET", to: "DRAW" },
        {
          type: "DRAW_ACTION",
          seat: 0,
          actionSeq: 3,
          drawCount: 1,
          discarded: [3],
          before: ["AS", "2D", "3C", "KH"],
          after: ["AS", "2D", "3C", "4H"],
          replacedCards: [{ index: 3, oldCard: "KH", newCard: "4H" }],
          stackBefore: 480,
          stackAfter: 480,
        },
        { type: "SHOWDOWN" },
        { type: "HAND_END", totalPot: 40, winners: [{ seat: 0, amount: 40 }] },
      ],
    };

    const frames = replayHandFromHistory(history);
    const callFrame = frames[2];
    expect(callFrame.event).toMatchObject({ seat: 0, action: "call", amount: 10, actionSeq: 1 });
    expect(callFrame.players.map((player) => player.stack)).toEqual([480, 480]);
    expect(callFrame.players.map((player) => player.betThisRound)).toEqual([20, 20]);
    expect(callFrame.pot).toBe(40);
    expect(callFrame.phase).toBe("BET");

    const drawFrame = frames[5];
    expect(drawFrame.event).toMatchObject({ seat: 0, drawCount: 1, discarded: [3] });
    expect(drawFrame.players[0].hand).toEqual(["AS", "2D", "3C", "4H"]);
    expect(drawFrame.phase).toBe("DRAW");

    const finalFrame = frames.at(-1);
    expect(finalFrame.players.map((player) => player.stack)).toEqual([520, 480]);
    expect(finalFrame.awardedPot).toBe(40);
    expect(finalFrame.pot).toBe(0);
    expect(finalFrame.integrity).toEqual({
      valid: true,
      stackMismatches: [],
      reconciliationMismatches: [],
      remainingPot: 0,
    });
  });

  it.each([
    { label: "cash", sourceFields: { historySource: "cash" } },
    {
      label: "tournament",
      sourceFields: { historySource: "tournament", tournamentId: "store-event-1" },
    },
  ])("audits a canonical $label record end-to-end", ({ sourceFields }) => {
    const history = {
      ...sourceFields,
      replaySchemaVersion: 2,
      handId: "audit-hand-1",
      seats: [
        {
          seat: 0,
          name: "Hero",
          startStack: 100,
          endStack: 110,
          initialHand: ["AS", "2D", "3C", "KH"],
          actions: [
            { seq: 1, street: "BET", type: "call", amount: 10 },
            {
              seq: 3,
              street: "DRAW",
              type: "draw",
              amount: 0,
              drawCount: 1,
              metadata: {
                drawInfo: {
                  before: ["AS", "2D", "3C", "KH"],
                  after: ["AS", "2D", "3C", "4H"],
                },
              },
            },
          ],
        },
        {
          seat: 1,
          name: "Villain",
          startStack: 100,
          endStack: 90,
          initialHand: ["5S", "6D", "7C", "8H"],
          actions: [{ seq: 2, street: "BET", type: "check", amount: 0 }],
        },
      ],
      events: [
        { type: "HAND_START", timestamp: 1 },
        { type: "BLINDS_POSTED", sbSeat: 0, sbAmount: 0, bbSeat: 1, bbAmount: 10, timestamp: 2 },
        {
          type: "BET_ACTION",
          seat: 0,
          action: "call",
          actionSeq: 1,
          amount: 10,
          potAfter: 20,
          timestamp: 3,
          playersAfter: [
            { seat: 0, stack: 90, betThisRound: 10, totalInvested: 10, hand: ["AS", "2D", "3C", "KH"] },
            { seat: 1, stack: 90, betThisRound: 10, totalInvested: 10, hand: ["5S", "6D", "7C", "8H"] },
          ],
        },
        {
          type: "BET_ACTION",
          seat: 1,
          action: "check",
          actionSeq: 2,
          amount: 0,
          potAfter: 20,
          timestamp: 4,
          playersAfter: [
            { seat: 0, stack: 90, betThisRound: 10, totalInvested: 10, hand: ["AS", "2D", "3C", "KH"] },
            { seat: 1, stack: 90, betThisRound: 10, totalInvested: 10, hand: ["5S", "6D", "7C", "8H"] },
          ],
        },
        { type: "PHASE_TRANSITION", from: "BET", to: "DRAW", timestamp: 5 },
        {
          type: "DRAW_ACTION",
          seat: 0,
          actionSeq: 3,
          drawCount: 1,
          discarded: [3],
          before: ["AS", "2D", "3C", "KH"],
          after: ["AS", "2D", "3C", "4H"],
          potAfter: 20,
          timestamp: 6,
          playersAfter: [
            { seat: 0, stack: 90, betThisRound: 0, totalInvested: 10, hand: ["AS", "2D", "3C", "4H"] },
            { seat: 1, stack: 90, betThisRound: 0, totalInvested: 10, hand: ["5S", "6D", "7C", "8H"] },
          ],
        },
        { type: "SHOWDOWN", timestamp: 7 },
        {
          type: "HAND_END",
          totalPot: 20,
          winners: [{ seat: 0, amount: 20 }],
          finalStacks: [{ seat: 0, stack: 110 }, { seat: 1, stack: 90 }],
          timestamp: 8,
        },
      ],
    };

    expect(auditHandReplayFidelity(history)).toEqual({
      valid: true,
      schemaVersion: 2,
      historySource: sourceFields.tournamentId ? "tournament" : "cash",
      eventCount: 8,
      actionCount: 3,
      issues: [],
    });
  });

  it("rejects a visually plausible replay when action order, cards, or settlement are corrupted", () => {
    const history = {
      replaySchemaVersion: 2,
      handId: "corrupt-hand",
      seats: [
        {
          seat: 0,
          startStack: 100,
          endStack: 100,
          initialHand: ["AS", "2D", "3C", "KH"],
          actions: [{ seq: 2, street: "DRAW", type: "draw", amount: 0 }],
        },
      ],
      events: [
        { type: "HAND_START", timestamp: 2 },
        {
          type: "DRAW_ACTION",
          seat: 0,
          actionSeq: 2,
          before: ["AS", "2D", "3C", "QH"],
          after: ["AS", "2D", "3C", "4H"],
          timestamp: 1,
        },
        {
          type: "HAND_END",
          totalPot: 0,
          winners: [],
          finalStacks: [{ seat: 0, stack: 90 }],
          timestamp: 3,
        },
      ],
    };

    const audit = auditHandReplayFidelity(history);
    expect(audit.valid).toBe(false);
    expect(audit.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "EVENT_TIMESTAMP_REGRESSION",
        "DRAW_BEFORE_CARDS_MISMATCH",
        "FINAL_RECONCILIATION_FAILED",
        "CHIP_CONSERVATION_FAILED",
      ]),
    );
  });

  it("keeps legacy stack records and sparse seat numbers replayable", () => {
    const frames = replayHandFromHistory({
      seats: [
        { seat: 0, name: "Hero", stack: 100 },
        { seat: 2, name: "Guest", stack: 100 },
      ],
      events: [
        { type: "HAND_START" },
        { type: "BLINDS_POSTED", sbSeat: 0, sbAmount: 5, bbSeat: 2, bbAmount: 10 },
      ],
    });

    expect(frames.at(-1).players.map((player) => [player.seat, player.stack])).toEqual([
      [0, 95],
      [2, 90],
    ]);
    expect(frames.at(-1).pot).toBe(15);
  });

  it("recovers old post-blind start stacks and winners from the saved UI summary", () => {
    const frames = replayHandFromHistory({
      seats: [
        {
          seat: 0,
          name: "Hero",
          startStack: 90,
          endStack: 120,
          actions: [{ seq: 1, street: "BET", type: "blind", amount: 10 }],
        },
        {
          seat: 1,
          name: "Guest",
          startStack: 80,
          endStack: 80,
          actions: [{ seq: 2, street: "BET", type: "blind", amount: 20 }],
        },
      ],
      events: [
        { type: "HAND_START" },
        { type: "BLINDS_POSTED", sbSeat: 0, sbAmount: 10, bbSeat: 1, bbAmount: 20 },
        { type: "HAND_END", totalPot: 30, winners: [] },
      ],
      uiSummary: { winners: [{ seatIndex: 0, payout: 30 }] },
    });

    expect(frames[0].players.map((player) => player.stack)).toEqual([100, 100]);
    expect(frames.at(-1).players.map((player) => player.stack)).toEqual([120, 80]);
    expect(frames.at(-1).integrity).toMatchObject({ valid: true, stackMismatches: [] });
  });

  it("does not award the pot twice when a collect snapshot already contains the payout", () => {
    const finalStacks = [
      { seat: 0, stack: 90 },
      { seat: 1, stack: 110 },
    ];
    const frames = replayHandFromHistory({
      replaySchemaVersion: 2,
      seats: [
        { seat: 0, startStack: 100, endStack: 90 },
        { seat: 1, startStack: 100, endStack: 110 },
      ],
      events: [
        { type: "HAND_START" },
        { type: "BLINDS_POSTED", sbSeat: 0, sbAmount: 10, bbSeat: 1, bbAmount: 10 },
        {
          type: "BET_ACTION",
          seat: 1,
          action: "collect",
          amount: 0,
          potAfter: 0,
          playersAfter: finalStacks,
        },
        {
          type: "HAND_END",
          totalPot: 20,
          winners: [{ seat: 1, amount: 20 }],
          finalStacks,
        },
      ],
    });

    expect(frames.at(-1).players.map((player) => player.stack)).toEqual([90, 110]);
    expect(frames.at(-1).integrity).toEqual({
      valid: true,
      stackMismatches: [],
      reconciliationMismatches: [],
      remainingPot: 0,
    });
  });
});
