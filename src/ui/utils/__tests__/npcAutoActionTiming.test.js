import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NPC_AUTO_ACTION_DELAY_MS,
  runNpcDrawAllInAutoFastPath,
  shouldBypassNpcDrawAllInAutoDelay,
} from "../npcAutoActionTiming.js";

function scheduleLikeNpcAutoEffect({ phase, seatIndex, player, autoResolveCpuDrawIfNeeded }) {
  if (
    runNpcDrawAllInAutoFastPath({
      phase,
      seatIndex,
      player,
      autoResolveCpuDrawIfNeeded,
    })
  ) {
    return null;
  }
  return setTimeout(() => {
    if (phase === "DRAW") {
      autoResolveCpuDrawIfNeeded();
    }
  }, NPC_AUTO_ACTION_DELAY_MS);
}

describe("npcAutoActionTiming", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bypasses the timer for all-in NPC draw actions", () => {
    vi.useFakeTimers();
    const autoResolveCpuDrawIfNeeded = vi.fn();

    const timer = scheduleLikeNpcAutoEffect({
      phase: "DRAW",
      seatIndex: 2,
      player: { allIn: true, stack: 0 },
      autoResolveCpuDrawIfNeeded,
    });

    expect(timer).toBeNull();
    expect(autoResolveCpuDrawIfNeeded).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the 250ms timer for non-all-in NPC draw actions", () => {
    vi.useFakeTimers();
    const autoResolveCpuDrawIfNeeded = vi.fn();

    const timer = scheduleLikeNpcAutoEffect({
      phase: "DRAW",
      seatIndex: 2,
      player: { allIn: false, stack: 120 },
      autoResolveCpuDrawIfNeeded,
    });

    expect(timer).not.toBeNull();
    expect(autoResolveCpuDrawIfNeeded).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(NPC_AUTO_ACTION_DELAY_MS - 1);
    expect(autoResolveCpuDrawIfNeeded).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(autoResolveCpuDrawIfNeeded).toHaveBeenCalledTimes(1);
  });

  it("does not alter the hero draw path even when hero is all-in", () => {
    const autoResolveCpuDrawIfNeeded = vi.fn();

    expect(
      runNpcDrawAllInAutoFastPath({
        phase: "DRAW",
        seatIndex: 0,
        player: { allIn: true, stack: 0 },
        autoResolveCpuDrawIfNeeded,
      }),
    ).toBe(false);
    expect(autoResolveCpuDrawIfNeeded).not.toHaveBeenCalled();
  });

  it("does not alter the existing BET all-in path", () => {
    const autoResolveCpuDrawIfNeeded = vi.fn();

    expect(
      shouldBypassNpcDrawAllInAutoDelay({
        phase: "BET",
        seatIndex: 2,
        player: { allIn: true, stack: 0 },
      }),
    ).toBe(false);
    expect(
      runNpcDrawAllInAutoFastPath({
        phase: "BET",
        seatIndex: 2,
        player: { allIn: true, stack: 0 },
        autoResolveCpuDrawIfNeeded,
      }),
    ).toBe(false);
    expect(autoResolveCpuDrawIfNeeded).not.toHaveBeenCalled();
  });
});
