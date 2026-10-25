import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VariantCardAvailability from "../VariantCardAvailability.jsx";
import { getVariantAvailability } from "../../../games/config/variantAvailability.js";

describe("VariantCardAvailability", () => {
  afterEach(() => cleanup());

  it("renders alpha labels", () => {
    render(<VariantCardAvailability availability={getVariantAvailability("D02")} />);
    expect(screen.getByTestId("variant-availability-badge").textContent).toContain("Alpha");
  });

  it("renders Japanese preview labels and reason", () => {
    render(<VariantCardAvailability availability={getVariantAvailability("S04")} language="ja" />);
    expect(screen.getByTestId("variant-availability-badge").textContent).toContain("検証中");
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/Badugi-family/);
  });

  it("explains public Hidugi Single Draw in the selected language", () => {
    const availability = getVariantAvailability("S07");
    const { rerender } = render(<VariantCardAvailability availability={availability} language="ja" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/4枚で1回交換/);
    rerender(<VariantCardAvailability availability={availability} language="en" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/aces are high/);
  });
});
