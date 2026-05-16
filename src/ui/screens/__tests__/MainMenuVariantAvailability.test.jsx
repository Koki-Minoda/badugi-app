import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MainMenuScreen from "../MainMenuScreen.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("MainMenu variant availability", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => cleanup());

  it("routes store tournament to an alpha-playable variant", () => {
    render(<MainMenuScreen language="en" />);
    fireEvent.click(screen.getByTestId("menu-tournament"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/game?mode=store_tournament&variant=ace_to_five_triple_draw",
      { state: { startTournamentMTT: true } },
    );
  });

  it("routes variant selection to the gated game selector", () => {
    render(<MainMenuScreen language="en" />);
    fireEvent.click(screen.getByTestId("menu-variant-select"));
    expect(mockNavigate).toHaveBeenCalledWith("/games?mode=cash");
  });
});
