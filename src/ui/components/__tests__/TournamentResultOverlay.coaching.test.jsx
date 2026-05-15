import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TournamentResultOverlay from "../TournamentResultOverlay.jsx";

const placements = [
  { id: "hero", place: 2, name: "Hero", stack: 880, payout: 320 },
  { id: "cpu-1", place: 1, name: "CPU 1", stack: 1640, payout: 500 },
];

const coachingPreview = {
  lessons: [
    {
      lessonId: "S02_DEEP_RAISECHECK_PC4",
      variantId: "S02",
      severity: "medium",
      lessonTag: "missed-value",
      estimatedEVGain: 36.8,
      recommendedAction: "RAISE",
      baselineAction: "CHECK",
      jp: "この場面ではレイズで価値を取りに行く方が期待値を改善できる可能性があります。",
      en: "Raising may capture more value than checking back.",
      replayRef: "step46-runA:20261099:6:5",
      replayUrl: "/replay?variant=S02&seed=20261099&hand=6&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC4",
      replayDeterministic: true,
    },
  ],
};

describe("TournamentResultOverlay coaching preview", () => {
  afterEach(() => cleanup());

  it("renders coaching lesson, EV, severity, and replay CTA", () => {
    const onCoachingReplay = vi.fn();
    const onCoachingTelemetry = vi.fn();
    render(
      <TournamentResultOverlay
        visible
        placements={placements}
        coachingPreview={coachingPreview}
        onCoachingReplay={onCoachingReplay}
        onCoachingTelemetry={onCoachingTelemetry}
      />,
    );

    expect(screen.getByTestId("mtt-coaching-preview")).toBeTruthy();
    expect(screen.getByText(/missed-value/)).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    expect(screen.getByText("EV +36.8")).toBeTruthy();
    expect(onCoachingTelemetry).toHaveBeenCalledWith("LESSON_SHOWN", coachingPreview.lessons[0]);
    fireEvent.click(screen.getByTestId("coaching-preview-open"));
    fireEvent.click(screen.getByTestId("coaching-preview-ack"));
    fireEvent.click(screen.getByTestId("coaching-preview-helpful"));
    fireEvent.click(screen.getByTestId("coaching-preview-replay"));
    expect(onCoachingTelemetry).toHaveBeenCalledWith("LESSON_OPENED", coachingPreview.lessons[0]);
    expect(onCoachingTelemetry).toHaveBeenCalledWith("LESSON_ACKNOWLEDGED", coachingPreview.lessons[0]);
    expect(onCoachingTelemetry).toHaveBeenCalledWith("LESSON_HELPFUL", coachingPreview.lessons[0]);
    expect(onCoachingTelemetry).toHaveBeenCalledWith("REPLAY_OPENED", coachingPreview.lessons[0]);
    expect(onCoachingReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: "S02_DEEP_RAISECHECK_PC4",
        href: coachingPreview.lessons[0].replayUrl,
        deterministic: true,
      }),
    );
  });

  it("keeps the original overlay path when coaching data is absent", () => {
    render(<TournamentResultOverlay visible placements={placements} />);
    expect(screen.queryByTestId("mtt-coaching-preview")).toBeNull();
    expect(screen.getAllByTestId("mtt-result-row")).toHaveLength(2);
  });
});
