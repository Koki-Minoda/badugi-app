import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LearningDashboardPreview from "../LearningDashboardPreview.jsx";

const dashboard = {
  global: {
    sessions: [{ sessionId: "a", sessionIndex: 1 }],
    totals: { actualDeltaPreview: 0, evDeltaReviewed: 94.7, lessonCount: 4, replayViewedCount: 2 },
    repeatedLeaks: [{ variantId: "S02", leakTag: "missed-value", count: 2 }],
  },
  byVariant: {
    S02: {
      sessions: [{ sessionId: "a", sessionIndex: 1 }],
      totals: { actualDeltaPreview: 0, evDeltaReviewed: 69, lessonCount: 2, replayViewedCount: 2 },
      repeatedLeaks: [{ variantId: "S02", leakTag: "missed-value", count: 2 }],
    },
  },
};

const chartSeries = {
  global: {
    actualResultCumulative: [{ x: 1, y: 0 }],
    evReviewedCumulative: [{ x: 1, y: 94.7 }],
  },
  byVariant: {
    S02: {
      actualResultCumulative: [{ x: 1, y: 0 }],
      evReviewedCumulative: [{ x: 1, y: 69 }],
    },
  },
};

describe("LearningDashboardPreview", () => {
  afterEach(() => cleanup());

  it("renders graph, variant tabs, and replay queue", () => {
    const onVariantChange = vi.fn();
    const onReplay = vi.fn();
    render(
      <LearningDashboardPreview
        dashboard={dashboard}
        chartSeries={chartSeries}
        replayQueue={{ items: [{ lessonId: "a", variantId: "S02", lessonTag: "missed-value", href: "/r" }] }}
        onVariantChange={onVariantChange}
        onReplay={onReplay}
      />,
    );
    expect(screen.getByTestId("learning-dashboard-preview")).toBeTruthy();
    expect(screen.getByTestId("learning-dashboard-chart")).toBeTruthy();
    expect(screen.getAllByTestId("ev-reviewed-point")).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId("learning-dashboard-variant-tab")[1]);
    fireEvent.click(screen.getByTestId("learning-dashboard-replay"));
    expect(onVariantChange).toHaveBeenCalledWith("S02");
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "a" }));
  });

  it("renders empty state", () => {
    render(<LearningDashboardPreview dashboard={{ global: { sessions: [] }, byVariant: {} }} chartSeries={{}} />);
    expect(screen.getByTestId("learning-dashboard-empty").textContent).toContain("まだ");
  });
});
