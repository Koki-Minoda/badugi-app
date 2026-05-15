import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CoachingRecapPanel from "../CoachingRecapPanel.jsx";

const recap = {
  estimatedTotalEVReviewed: 69,
  replayRevisitCount: 2,
  repeatedLeaks: [{ leakTag: "missed-value", count: 2 }],
  primaryRecommendation: "強い手でチェックしすぎる場面を見直しましょう",
  recentLessons: [
    {
      lessonId: "pc4",
      sessionId: "s2",
      severity: "medium",
      titleJp: "4人局面の価値を取り逃した場面",
      evDelta: 36.8,
      replayUrl: "/replay",
      replayRef: "r",
      replayDeterministic: true,
    },
  ],
};

describe("CoachingRecapPanel", () => {
  afterEach(() => cleanup());

  it("renders recap sections and replay/clear actions", () => {
    const onReplay = vi.fn();
    const onClearHistory = vi.fn();
    render(<CoachingRecapPanel recap={recap} onReplay={onReplay} onClearHistory={onClearHistory} />);
    expect(screen.getByTestId("coaching-recap-panel")).toBeTruthy();
    expect(screen.getByTestId("coaching-recap-repeated").textContent).toContain("missed-value");
    expect(screen.getByTestId("coaching-recap-replays").textContent).toBe("2");
    fireEvent.click(screen.getByTestId("coaching-recap-replay"));
    fireEvent.click(screen.getByTestId("coaching-recap-clear"));
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "pc4", href: "/replay" }));
    expect(onClearHistory).toHaveBeenCalled();
  });

  it("renders empty state", () => {
    render(<CoachingRecapPanel recap={{ recentLessons: [] }} locale="en" />);
    expect(screen.getByTestId("coaching-recap-empty").textContent).toContain("No coaching");
  });
});
