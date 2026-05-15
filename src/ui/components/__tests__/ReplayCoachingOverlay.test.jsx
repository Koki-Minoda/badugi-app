import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReplayCoachingOverlay from "../ReplayCoachingOverlay.jsx";

const annotation = {
  lessonId: "S02_DEEP_RAISECHECK_PC4",
  severity: "medium",
  lessonTag: "missed-value",
  evDelta: 36.8,
  jp: "この場面ではレイズの方が期待値を改善できる可能性があります。",
  en: "Raising may capture more value.",
  baselineAction: "CHECK",
  highlightAction: "RAISE",
};

describe("ReplayCoachingOverlay", () => {
  afterEach(() => cleanup());

  it("renders missed value, EV, severity, and locale copy", () => {
    render(<ReplayCoachingOverlay annotation={annotation} locale="jp" />);
    expect(screen.getByTestId("replay-coaching-overlay")).toBeTruthy();
    expect(screen.getByText("Missed Value")).toBeTruthy();
    expect(screen.getByTestId("replay-coaching-ev").textContent).toBe("EV +36.8");
    expect(screen.getByTestId("replay-coaching-severity").textContent).toBe("medium");
    expect(screen.getByTestId("replay-coaching-copy").textContent).toContain("レイズ");
  });

  it("can be dismissed without crashing replay", () => {
    const onDismissed = vi.fn();
    render(<ReplayCoachingOverlay annotation={annotation} locale="en" onDismissed={onDismissed} />);
    fireEvent.click(screen.getByTestId("replay-coaching-close"));
    expect(screen.queryByTestId("replay-coaching-overlay")).toBeNull();
    expect(onDismissed).toHaveBeenCalledWith(annotation);
  });

  it("emits helpful and acknowledgement telemetry callbacks", () => {
    const onAcknowledged = vi.fn();
    const onHelpful = vi.fn();
    const onNotHelpful = vi.fn();
    render(
      <ReplayCoachingOverlay
        annotation={annotation}
        locale="en"
        onAcknowledged={onAcknowledged}
        onHelpful={onHelpful}
        onNotHelpful={onNotHelpful}
      />,
    );

    fireEvent.click(screen.getByTestId("replay-coaching-ack"));
    fireEvent.click(screen.getByTestId("replay-coaching-helpful"));
    fireEvent.click(screen.getByTestId("replay-coaching-not-helpful"));
    expect(onAcknowledged).toHaveBeenCalledWith(annotation);
    expect(onHelpful).toHaveBeenCalledWith(annotation);
    expect(onNotHelpful).toHaveBeenCalledWith(annotation);
  });
});
