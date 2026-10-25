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

  it("renders the published Badugi Single Draw status and Japanese guidance", () => {
    render(<VariantCardAvailability availability={getVariantAvailability("S04")} language="ja" />);
    expect(screen.getByTestId("variant-availability-badge").textContent).toContain("Alpha");
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/4枚で1回だけ交換/);
  });

  it("explains the published split single-draw ace rules in Japanese", () => {
    render(<VariantCardAvailability availability={getVariantAvailability("S05")} language="ja" />);
    expect(screen.getByTestId("variant-availability-badge").textContent).toContain("Alpha");
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/Badugi側のAは高い/);
  });

  it("explains public Hidugi Single Draw in the selected language", () => {
    const availability = getVariantAvailability("S07");
    const { rerender } = render(<VariantCardAvailability availability={availability} language="ja" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/4枚で1回交換/);
    rerender(<VariantCardAvailability availability={availability} language="en" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/aces are high/);
  });

  it("explains public Hidugi Triple Draw in the selected language", () => {
    const availability = getVariantAvailability("D06");
    const { rerender } = render(<VariantCardAvailability availability={availability} language="ja" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/最大3回交換/);
    rerender(<VariantCardAvailability availability={availability} language="en" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/aces are high/);
  });

  it("explains public Badeucey Triple Draw in the selected language", () => {
    const availability = getVariantAvailability("D04");
    const { rerender } = render(<VariantCardAvailability availability={availability} language="ja" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/最大3回交換/);
    rerender(<VariantCardAvailability availability={availability} language="en" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/aces are high/);
  });

  it("explains public Badacey Triple Draw in the selected language", () => {
    const availability = getVariantAvailability("D05");
    const { rerender } = render(<VariantCardAvailability availability={availability} language="ja" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/最大3回交換/);
    rerender(<VariantCardAvailability availability={availability} language="en" />);
    expect(screen.getByTestId("variant-availability-reason").textContent).toMatch(/aces are low/);
  });
});
