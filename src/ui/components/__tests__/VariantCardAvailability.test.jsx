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
});
