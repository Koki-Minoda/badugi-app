import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CoachingSummaryPanel from "../CoachingSummaryPanel.jsx";

const summary = {
  summary: { jp: "今回の学習ポイント 2件", en: "2 learning points from this tournament" },
  totalEstimatedEVGain: 69,
  topLessons: [
    {
      lessonId: "pc4",
      titleJp: "価値を取り逃した場面",
      titleEn: "Missed value spot",
      variantId: "S02",
      severity: "medium",
      estimatedEVGain: 36.8,
      jp: "レイズで価値を取りに行く方が期待値を改善できる可能性があります。",
      en: "Raising may capture more value.",
      replayUrl: "/replay/pc4",
      replayDeterministic: true,
    },
  ],
};

describe("CoachingSummaryPanel", () => {
  afterEach(() => cleanup());

  it("renders compact summary and emits replay/helpful callbacks", () => {
    const onReplay = vi.fn();
    const onHelpful = vi.fn();
    render(<CoachingSummaryPanel summary={summary} locale="jp" onReplay={onReplay} onHelpful={onHelpful} />);
    expect(screen.getByTestId("coaching-summary-panel")).toBeTruthy();
    expect(screen.getByTestId("coaching-summary-heading").textContent).toContain("学習ポイント");
    expect(screen.getByTestId("coaching-summary-total-ev").textContent).toBe("EV +69.0");
    fireEvent.click(screen.getByTestId("coaching-summary-helpful"));
    fireEvent.click(screen.getByTestId("coaching-summary-replay"));
    expect(onHelpful).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "pc4" }));
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "pc4", href: "/replay/pc4" }));
  });

  it("renders a safe empty state", () => {
    render(<CoachingSummaryPanel summary={{ topLessons: [] }} locale="en" />);
    expect(screen.getByTestId("coaching-summary-empty").textContent).toContain("No coaching");
  });
});
