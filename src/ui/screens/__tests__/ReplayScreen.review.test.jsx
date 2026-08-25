import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ReplayScreen from "../ReplayScreen.jsx";
import { setHandHistoryAccessors } from "../../state/handHistoryStore.js";
import { buildReplayReviewContract } from "../../feedback/replayReviewContract.js";

function makeReviewHand() {
  return {
    handId: "review-hand-1",
    variantId: "badugi",
    startedAt: Date.now() - 2000,
    endedAt: Date.now(),
    seats: [
      { seat: 0, name: "Hero", stack: 1000 },
      { seat: 1, name: "Sora", stack: 1000 },
    ],
    events: [
      { type: "HAND_START", timestamp: Date.now() - 1800 },
      {
        type: "BET_ACTION",
        seat: 0,
        action: "call",
        amount: 20,
        actionSeq: 2,
        timestamp: Date.now() - 1200,
      },
      {
        type: "HAND_END",
        totalPot: 80,
        winners: [{ seat: 1, amount: 80 }],
        timestamp: Date.now() - 400,
      },
    ],
  };
}

describe("ReplayScreen review integration", () => {
  afterEach(() => {
    cleanup();
    setHandHistoryAccessors({
      readCurrent: () => null,
      readBuffer: () => [],
      findById: () => null,
    });
  });

  it("shows review context and marks the target replay frame", async () => {
    const hand = makeReviewHand();
    const replayReview = buildReplayReviewContract({
      reviewMode: "tournament",
      keyHand: {
        handId: hand.handId,
        reason: "bust-hand",
        title: "Final call review",
        description: "トーナメント終了につながった局面です。",
        variantId: "badugi",
        phase: "BET",
        heroAction: "call",
      },
      replayRef: {
        handId: hand.handId,
        variantId: "badugi",
        target: { handId: hand.handId, actionSeqStart: 2, actionSeqEnd: 2 },
        available: true,
      },
    });
    setHandHistoryAccessors({
      readCurrent: () => hand,
      readBuffer: () => [hand],
      findById: (handId) => (handId === hand.handId ? hand : null),
    });

    render(
      <ReplayScreen
        handId={hand.handId}
        target={{ handId: hand.handId, actionSeqStart: 2, replayReview }}
      />,
    );

    const panel = await screen.findByTestId("replay-review-panel");
    expect(panel.textContent).toContain("Replay Review");
    expect(panel.textContent).toContain("Final call review");
    expect(panel.textContent).toContain("良かった点");
    expect(panel.textContent).toContain("改善点");
    expect(screen.getByTestId("replay-review-reason").textContent).toContain("Bust hand");
    expect(screen.getByTestId("replay-review-timeline-marker").textContent).toContain("Bust hand");

    const targetRow = screen.getByTestId("replay-event-row-1");
    await waitFor(() => expect(targetRow.getAttribute("data-review-highlight")).toBe("true"));
    expect(screen.getByTestId("replay-frame-counter").textContent).toContain("Frame 2 / 3");

    fireEvent.click(screen.getByTestId("replay-event-row-2"));
    expect(screen.getByTestId("replay-frame-counter").textContent).toContain("Frame 3 / 3");
    fireEvent.click(screen.getByTestId("replay-review-jump"));
    expect(screen.getByTestId("replay-frame-counter").textContent).toContain("Frame 2 / 3");
  });

  it("keeps replay usable when no review context is present", async () => {
    const hand = makeReviewHand();
    setHandHistoryAccessors({
      readCurrent: () => hand,
      readBuffer: () => [hand],
      findById: (handId) => (handId === hand.handId ? hand : null),
    });

    render(<ReplayScreen handId={hand.handId} target={{ handId: hand.handId }} />);

    expect(await screen.findByTestId("hand-replay-screen")).toBeTruthy();
    expect(screen.queryByTestId("replay-review-panel")).toBeNull();
    expect(screen.queryByTestId("replay-review-timeline-marker")).toBeNull();
  });
});
