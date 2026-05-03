import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ShowdownResultToast from "../ShowdownResultToast.jsx";
import { buildShowdownToastItems } from "../../utils/showdownResultToast.js";

afterEach(() => {
  cleanup();
});

describe("ShowdownResultToast", () => {
  it("summarizes main and side pots", () => {
    const summary = {
      pot: 900,
      potDetails: [
        { potIndex: 0, potAmount: 400, winners: [{ name: "CPU 3" }] },
        { potIndex: 1, potAmount: 300, winners: [{ name: "CPU 3" }] },
        { potIndex: 2, potAmount: 200, winners: [{ name: "CPU 4" }] },
      ],
    };

    expect(buildShowdownToastItems(summary).map((item) => item.label)).toEqual([
      "Pot",
      "Side",
      "Side 2",
    ]);

    render(<ShowdownResultToast visible summary={summary} />);

    expect(screen.getByTestId("showdown-result-toast").textContent).toContain("Total Pot 900");
    expect(screen.getByTestId("showdown-result-toast").textContent).toContain("CPU 3");
    expect(screen.getByTestId("showdown-result-toast").textContent).toContain("CPU 4");
  });

  it("does not render without winners", () => {
    render(<ShowdownResultToast visible summary={{ pot: 0, winners: [] }} />);
    expect(screen.queryByTestId("showdown-result-toast")).toBeNull();
  });
});
