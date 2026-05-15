import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CoachingRecapPanel from "../CoachingRecapPanel.jsx";

const recap = {
  estimatedTotalEVReviewed: 94.7,
  replayRevisitCount: 2,
  repeatedLeaks: [{ leakTag: "missed-value", count: 2 }],
  byVariant: {
    S02: {
      repeatedLeaks: [{ leakTag: "missed-value", count: 2 }],
    },
    D02: {
      repeatedLeaks: [{ leakTag: "second-pressure", count: 2 }],
    },
  },
  primaryRecommendation: "S02では強い手でチェックしすぎる場面を見直しましょう",
  recentLessons: [
    {
      lessonId: "s02",
      sessionId: "s1",
      variantId: "S02",
      severity: "medium",
      titleJp: "S02の価値を取り逃した場面",
      evDelta: 36.8,
      replayUrl: "/replay?s02",
      replayRef: "r-s02",
      replayDeterministic: true,
    },
    {
      lessonId: "d02",
      sessionId: "s2",
      variantId: "D02",
      severity: "low",
      titleJp: "D02の圧力判断",
      evDelta: 11.2,
    },
  ],
};

describe("CoachingRecapPanel variant filter", () => {
  afterEach(() => cleanup());

  it("renders all variants and variant badges", () => {
    const onVariantChange = vi.fn();
    render(<CoachingRecapPanel recap={recap} onVariantChange={onVariantChange} />);
    expect(screen.getAllByTestId("coaching-recap-variant-tab").map((tab) => tab.textContent)).toEqual(["すべて", "D02", "S02"]);
    expect(screen.getAllByTestId("coaching-recap-variant-badge").map((badge) => badge.textContent)).toContain("S02");
    fireEvent.click(screen.getAllByTestId("coaching-recap-variant-tab")[1]);
    expect(onVariantChange).toHaveBeenCalledWith("D02");
  });

  it("filters to S02-only view", () => {
    render(<CoachingRecapPanel recap={recap} selectedVariant="S02" />);
    expect(screen.getAllByTestId("coaching-recap-lesson")).toHaveLength(1);
    expect(screen.getAllByText("S02").length).toBeGreaterThan(0);
    expect(screen.queryByText("D02")).toBeTruthy();
    expect(screen.getByTestId("coaching-recap-repeated").textContent).toContain("missed-value");
  });

  it("renders per-variant empty state", () => {
    render(<CoachingRecapPanel recap={recap} selectedVariant="S01" />);
    expect(screen.getByTestId("coaching-recap-empty").textContent).toContain("この種目");
  });
});
