import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import HeroBustOverlay from "../HeroBustOverlay.jsx";

describe("HeroBustOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders hero summary and in-the-money rows", () => {
    render(
      <HeroBustOverlay
        visible
        title="In the Money"
        heroSummary={{ place: 5, payout: 0 }}
        inMoneyPlacements={[
          { id: "p1", place: 1, name: "CPU 1", stack: 1200, payout: 500 },
          { id: "p2", place: 2, name: "CPU 2", stack: 800, payout: 300 },
        ]}
        onBackToMenu={() => {}}
      />,
    );

    expect(screen.getByTestId("mtt-hero-bust-overlay")).not.toBeNull();
    expect(screen.getByTestId("mtt-hero-bust-hero-summary").textContent).toContain(
      "You finished in 5th place",
    );
    const itmRows = screen.getAllByTestId("mtt-hero-bust-itm-row");
    expect(itmRows).toHaveLength(2);
    expect(itmRows[0].textContent).toContain("CPU 1");
    expect(itmRows[1].textContent).toContain("Payout 300");
  });

  it("invokes back-to-menu handler", () => {
    const handler = vi.fn();
    render(
      <HeroBustOverlay
        visible
        heroSummary={{ place: 4, payout: 0 }}
        inMoneyPlacements={[]}
        onBackToMenu={handler}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns null when not visible", () => {
    const { container } = render(<HeroBustOverlay visible={false} />);
    expect(container.firstChild).toBeNull();
  });
});
