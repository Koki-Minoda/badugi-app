import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import HandResultOverlay from "../HandResultOverlay.jsx";

const result = { visible: true, summary: { handId: "hand-1", pot: 20 } };
const tick = ms => act(() => vi.advanceTimersByTime(ms));
const next = () => screen.getByTestId("hand-result-next-hand");
const toggle = () => screen.getByTestId("hand-result-auto-next");

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("lets the result be read for two seconds, then advances only once", () => {
  const handler = vi.fn();
  render(<HandResultOverlay {...result} onNext={handler} onAutoNext={handler} />);
  tick(1999);
  expect(handler).not.toHaveBeenCalled();
  tick(1);
  fireEvent.click(next());
  tick(3000);
  expect(handler).toHaveBeenCalledTimes(1);
});

it("manual Next cancels the timer and ignores a duplicate click", () => {
  const handler = vi.fn();
  render(<HandResultOverlay {...result} onNext={handler} onAutoNext={handler} />);
  fireEvent.click(next());
  fireEvent.click(next());
  tick(2000);
  expect(handler).toHaveBeenCalledTimes(1);
});

it.each(["history", "cash-out"])("pauses immediately when opening %s and allows explicit resume", kind => {
  const handler = vi.fn();
  const detail = vi.fn();
  render(<HandResultOverlay {...result} onAutoNext={handler} onHistory={detail} onCashOut={detail} />);
  tick(1999);
  fireEvent.click(screen.getByTestId(`hand-result-${kind}`));
  tick(3000);
  expect(detail).toHaveBeenCalledOnce();
  expect(handler).not.toHaveBeenCalled();
  fireEvent.click(toggle());
  tick(2000);
  expect(handler).toHaveBeenCalledOnce();
});

it("pauses on a replay link before handing off to the review", () => {
  const handler = vi.fn();
  const replay = vi.fn();
  const target = { handId: "hand-1", index: 1 };
  const summary = { ...result.summary, followUpSummary: { issueCount: 1, topIssue: {}, replayTarget: target } };
  render(<HandResultOverlay {...result} summary={summary} onAutoNext={handler} onReplayTarget={replay} />);
  tick(1000);
  fireEvent.click(screen.getByTestId("hand-result-follow-up-replay"));
  tick(4000);
  expect(replay).toHaveBeenCalledWith(target);
  expect(handler).not.toHaveBeenCalled();
});

it("cancels a stale timer when the result is replaced or disappears", () => {
  const oldHand = vi.fn();
  const newHand = vi.fn();
  const { rerender } = render(<HandResultOverlay {...result} onAutoNext={oldHand} />);
  tick(1900);
  rerender(<HandResultOverlay {...result} summary={{ handId: "hand-2" }} onAutoNext={newHand} />);
  tick(1900);
  expect(oldHand).not.toHaveBeenCalled();
  expect(newHand).not.toHaveBeenCalled();
  rerender(<HandResultOverlay {...result} visible={false} onAutoNext={newHand} />);
  tick(3000);
  expect(newHand).not.toHaveBeenCalled();
});

it("only arms a fresh countdown after the tab becomes visible", () => {
  const handler = vi.fn();
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  render(<HandResultOverlay {...result} onAutoNext={handler} />);
  tick(1900);
  const setHidden = value => act(() => {
    hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  setHidden(true);
  tick(4000);
  expect(handler).not.toHaveBeenCalled();
  setHidden(false);
  tick(1999);
  expect(handler).not.toHaveBeenCalled();
  tick(1);
  expect(handler).toHaveBeenCalledOnce();
});

it("never auto-advances a trial or while another dialog blocks the result", () => {
  const handler = vi.fn();
  const { rerender } = render(<HandResultOverlay {...result} guestTrial onAutoNext={handler} />);
  tick(2000);
  rerender(<HandResultOverlay {...result} autoNextBlocked onAutoNext={handler} />);
  tick(2000);
  expect(handler).not.toHaveBeenCalled();
});

it("keeps the manual choice across hands until explicitly resumed", () => {
  const handler = vi.fn();
  const { rerender } = render(<HandResultOverlay {...result} onAutoNext={handler} />);
  fireEvent.click(toggle());
  rerender(<HandResultOverlay {...result} summary={{ handId: "hand-2" }} onAutoNext={handler} />);
  tick(4000);
  expect(handler).not.toHaveBeenCalled();
  fireEvent.click(toggle());
  tick(2000);
  expect(handler).toHaveBeenCalledOnce();
});
