// Run: npx vitest src/games/core/__tests__/applyChips.test.js
import { describe, expect, it } from "vitest";
import { applyChips } from "../applyChips.js";

function expectAppliedBounds(applied, amount, beforeStack) {
  const maxStack = Math.max(0, beforeStack);
  expect(applied).toBeGreaterThanOrEqual(0);
  expect(applied).toBeLessThanOrEqual(maxStack);
  expect(applied).toBeLessThanOrEqual(amount);
}

describe("applyChips single-source accounting", () => {
  it("ante: stack<anteValue applies once and updates betThisRound with applied", () => {
    const player = {
      stack: 7,
      totalInvested: 0,
      betThisRound: 0,
      lastAction: "",
      allIn: false,
    };
    const anteValue = 10;
    const beforeStack = player.stack;
    const beforeInvested = player.totalInvested;
    const beforeBet = player.betThisRound;
    const applied = applyChips(player, anteValue);
    expectAppliedBounds(applied, anteValue, beforeStack);
    expect(player.betThisRound).toBe(beforeBet);
    player.betThisRound += applied;
    if (player.stack === 0) player.allIn = true;

    expect(applied).toBe(7);
    expect(player.stack).toBe(beforeStack - applied);
    expect(player.totalInvested).toBe(beforeInvested + applied);
    expect(player.betThisRound).toBe(beforeBet + applied);
    expect(player.allIn).toBe(true);
  });

  it("sb/bb: applied mirrors stack and totalInvested without double updates", () => {
    const sbPlayer = { stack: 100, totalInvested: 0, betThisRound: 0 };
    const bbPlayer = { stack: 8, totalInvested: 0, betThisRound: 0 };
    const sbValue = 5;
    const bbValue = 10;

    const sbBeforeStack = sbPlayer.stack;
    const sbBeforeInvested = sbPlayer.totalInvested;
    const sbBeforeBet = sbPlayer.betThisRound;
    const sbApplied = applyChips(sbPlayer, sbValue);
    expectAppliedBounds(sbApplied, sbValue, sbBeforeStack);
    expect(sbPlayer.betThisRound).toBe(sbBeforeBet);
    sbPlayer.betThisRound += sbApplied;
    expect(sbPlayer.stack).toBe(sbBeforeStack - sbApplied);
    expect(sbPlayer.totalInvested).toBe(sbBeforeInvested + sbApplied);
    expect(sbPlayer.betThisRound).toBe(sbBeforeBet + sbApplied);

    const bbBeforeStack = bbPlayer.stack;
    const bbBeforeInvested = bbPlayer.totalInvested;
    const bbBeforeBet = bbPlayer.betThisRound;
    const bbApplied = applyChips(bbPlayer, bbValue); // all-in
    expectAppliedBounds(bbApplied, bbValue, bbBeforeStack);
    expect(bbPlayer.betThisRound).toBe(bbBeforeBet);
    bbPlayer.betThisRound += bbApplied;
    expect(bbPlayer.stack).toBe(bbBeforeStack - bbApplied);
    expect(bbPlayer.totalInvested).toBe(bbBeforeInvested + bbApplied);
    expect(bbPlayer.betThisRound).toBe(bbBeforeBet + bbApplied);

    expect(sbApplied).toBe(5);

    expect(bbApplied).toBe(8);
    expect(bbPlayer.stack).toBe(0);
  });

  it("call/raise all-in: applied < requested and logs use applied", () => {
    const caller = { stack: 6, totalInvested: 0, betThisRound: 2, lastAction: "" };
    const toCall = 10;
    const callBeforeStack = caller.stack;
    const callBeforeInvested = caller.totalInvested;
    const callBeforeBet = caller.betThisRound;
    const appliedCall = applyChips(caller, toCall);
    expectAppliedBounds(appliedCall, toCall, callBeforeStack);
    expect(caller.betThisRound).toBe(callBeforeBet);
    caller.betThisRound += appliedCall;
    caller.lastAction = appliedCall < toCall ? "Call (All-in)" : "Call";

    expect(appliedCall).toBe(6);
    expect(caller.stack).toBe(callBeforeStack - appliedCall);
    expect(caller.totalInvested).toBe(callBeforeInvested + appliedCall);
    expect(caller.betThisRound).toBe(callBeforeBet + appliedCall);
    expect(caller.lastAction).toBe("Call (All-in)");

    const raiser = { stack: 9, totalInvested: 0, betThisRound: 0, lastAction: "" };
    const raiseTotal = 12;
    const raiseBeforeStack = raiser.stack;
    const raiseBeforeInvested = raiser.totalInvested;
    const raiseBeforeBet = raiser.betThisRound;
    const appliedRaise = applyChips(raiser, raiseTotal);
    expectAppliedBounds(appliedRaise, raiseTotal, raiseBeforeStack);
    expect(raiser.betThisRound).toBe(raiseBeforeBet);
    raiser.betThisRound += appliedRaise;
    raiser.lastAction = appliedRaise < raiseTotal ? "Raise (All-in)" : "Raise";

    expect(appliedRaise).toBe(9);
    expect(raiser.stack).toBe(raiseBeforeStack - appliedRaise);
    expect(raiser.totalInvested).toBe(raiseBeforeInvested + appliedRaise);
    expect(raiser.betThisRound).toBe(raiseBeforeBet + appliedRaise);
    expect(raiser.lastAction).toBe("Raise (All-in)");
  });

  it("call/raise sufficient stack uses non all-in labels", () => {
    const caller = { stack: 50, totalInvested: 4, betThisRound: 1, lastAction: "" };
    const toCall = 10;
    const callBeforeStack = caller.stack;
    const callBeforeInvested = caller.totalInvested;
    const callBeforeBet = caller.betThisRound;
    const appliedCall = applyChips(caller, toCall);
    expectAppliedBounds(appliedCall, toCall, callBeforeStack);
    expect(caller.betThisRound).toBe(callBeforeBet);
    caller.betThisRound += appliedCall;
    caller.lastAction = appliedCall < toCall ? "Call (All-in)" : "Call";

    expect(appliedCall).toBe(toCall);
    expect(caller.stack).toBe(callBeforeStack - appliedCall);
    expect(caller.totalInvested).toBe(callBeforeInvested + appliedCall);
    expect(caller.betThisRound).toBe(callBeforeBet + appliedCall);
    expect(caller.lastAction).toBe("Call");

    const raiser = { stack: 40, totalInvested: 0, betThisRound: 0, lastAction: "" };
    const raiseTotal = 12;
    const raiseBeforeStack = raiser.stack;
    const raiseBeforeInvested = raiser.totalInvested;
    const raiseBeforeBet = raiser.betThisRound;
    const appliedRaise = applyChips(raiser, raiseTotal);
    expectAppliedBounds(appliedRaise, raiseTotal, raiseBeforeStack);
    expect(raiser.betThisRound).toBe(raiseBeforeBet);
    raiser.betThisRound += appliedRaise;
    raiser.lastAction = appliedRaise < raiseTotal ? "Raise (All-in)" : "Raise";

    expect(appliedRaise).toBe(raiseTotal);
    expect(raiser.stack).toBe(raiseBeforeStack - appliedRaise);
    expect(raiser.totalInvested).toBe(raiseBeforeInvested + appliedRaise);
    expect(raiser.betThisRound).toBe(raiseBeforeBet + appliedRaise);
    expect(raiser.lastAction).toBe("Raise");
  });

  it("amount<=0 returns 0 and leaves state unchanged", () => {
    const player = { stack: 20, totalInvested: 3, betThisRound: 4 };
    const before = { ...player };

    expect(applyChips(player, 0)).toBe(0);
    expect(applyChips(player, -5)).toBe(0);

    expect(player.stack).toBe(before.stack);
    expect(player.totalInvested).toBe(before.totalInvested);
    expect(player.betThisRound).toBe(before.betThisRound);
  });

  it("stack=0 with amount>0 returns 0 and leaves state unchanged", () => {
    const player = { stack: 0, totalInvested: 5, betThisRound: 3 };
    const before = { ...player };

    const applied = applyChips(player, 10);

    expect(applied).toBe(0);
    expect(player.stack).toBe(before.stack);
    expect(player.totalInvested).toBe(before.totalInvested);
    expect(player.betThisRound).toBe(before.betThisRound);
  });

  it("negative stack does not invest (stack value is preserved)", () => {
    const player = { stack: -4, totalInvested: 2, betThisRound: 1 };
    const before = { ...player };

    const applied = applyChips(player, 10);

    expect(applied).toBe(0);
    expect(player.stack).toBe(before.stack);
    expect(player.totalInvested).toBe(before.totalInvested);
    expect(player.betThisRound).toBe(before.betThisRound);
  });

  it("amount>0 after all-in is a no-op", () => {
    const player = { stack: 6, totalInvested: 10, betThisRound: 2 };
    const firstBeforeStack = player.stack;
    const firstBeforeInvested = player.totalInvested;
    const firstBeforeBet = player.betThisRound;

    const firstApplied = applyChips(player, 10);
    expectAppliedBounds(firstApplied, 10, firstBeforeStack);
    expect(player.betThisRound).toBe(firstBeforeBet);
    player.betThisRound += firstApplied;

    expect(firstApplied).toBe(firstBeforeStack);
    expect(player.stack).toBe(firstBeforeStack - firstApplied);
    expect(player.totalInvested).toBe(firstBeforeInvested + firstApplied);
    expect(player.betThisRound).toBe(firstBeforeBet + firstApplied);

    const secondBefore = {
      stack: player.stack,
      totalInvested: player.totalInvested,
      betThisRound: player.betThisRound,
    };
    const secondApplied = applyChips(player, 5);

    expect(secondApplied).toBe(0);
    expect(player.stack).toBe(secondBefore.stack);
    expect(player.totalInvested).toBe(secondBefore.totalInvested);
    expect(player.betThisRound).toBe(secondBefore.betThisRound);
  });

  it("totalInvested baseline non-zero increments additively", () => {
    const player = { stack: 25, totalInvested: 40, betThisRound: 0 };
    const beforeStack = player.stack;
    const beforeInvested = player.totalInvested;
    const beforeBet = player.betThisRound;

    const applied = applyChips(player, 10);
    expectAppliedBounds(applied, 10, beforeStack);
    expect(player.betThisRound).toBe(beforeBet);
    player.betThisRound += applied;

    expect(applied).toBe(10);
    expect(player.stack).toBe(beforeStack - applied);
    expect(player.totalInvested).toBe(beforeInvested + applied);
    expect(player.betThisRound).toBe(beforeBet + applied);
  });
});
