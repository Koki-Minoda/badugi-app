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

vi.mock("../../components/VariantSelectModal.jsx", () => ({
  default: ({ isOpen, onSelectVariant, onClose }) =>
    isOpen ? (
      <div data-testid="variant-select-modal">
        <p>Select a variant</p>
        <button type="button" onClick={() => onSelectVariant("badugi")}>
          Badugi
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

describe("MainMenuScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders mode buttons and routes cash game to the selector screen", () => {
    render(<MainMenuScreen language="en" />);
    expect(screen.getByRole("button", { name: /cash game/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tournament/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /friend match/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /cash game/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/games?mode=cash");
  });

  it("routes explicit variant selection to the selector screen", () => {
    render(<MainMenuScreen language="en" />);
    fireEvent.click(screen.getByTestId("menu-variant-select"));
    expect(mockNavigate).toHaveBeenCalledWith("/games?mode=cash");
  });

  it("uses the provided selector callback for cash and variant buttons", () => {
    const handleSelectRing = vi.fn();
    render(<MainMenuScreen language="en" onSelectRing={handleSelectRing} />);

    fireEvent.click(screen.getByTestId("menu-ring"));
    expect(handleSelectRing).toHaveBeenCalledWith();

    fireEvent.click(screen.getByTestId("menu-variant-select"));
    expect(handleSelectRing).toHaveBeenCalledTimes(2);
  });

  it("routes to tournament and friend match flows", () => {
    render(<MainMenuScreen language="en" />);

    fireEvent.click(screen.getByRole("button", { name: /tournament/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/game?mode=store_tournament&variant=ace_to_five_triple_draw", {
      state: { startTournamentMTT: true },
    });

    fireEvent.click(screen.getByRole("button", { name: /friend match/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/friend-match");
  });

  it("routes hand history when no in-app callback is provided", () => {
    render(<MainMenuScreen language="ja" />);
    fireEvent.click(screen.getByTestId("menu-history"));
    expect(mockNavigate).toHaveBeenCalledWith("/history");
  });

  it("hides learning dashboard preview when the preview flag is off", () => {
    render(<MainMenuScreen language="en" coachingPreviewEnabled={false} />);
    expect(screen.queryByTestId("menu-learning-dashboard-preview")).toBeNull();
  });

  it("shows learning dashboard preview only when explicitly enabled", () => {
    render(<MainMenuScreen language="en" coachingPreviewEnabled />);
    fireEvent.click(screen.getByTestId("menu-learning-dashboard-preview"));
    expect(mockNavigate).toHaveBeenCalledWith("/learning-dashboard-preview?mgxPreview=coaching");
  });

  it("uses the provided hand history callback inside App flow", () => {
    const handleHistory = vi.fn();
    render(<MainMenuScreen language="ja" onSelectHandHistory={handleHistory} />);
    fireEvent.click(screen.getByTestId("menu-history"));
    expect(handleHistory).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalledWith("/history");
  });

  it("binds the language select value to props", () => {
    render(<MainMenuScreen language="ja" />);
    fireEvent.click(screen.getByRole("button", { name: /open settings/i }));
    expect(screen.getByTestId("language-select").value).toBe("ja");
  });

  it("uses Japanese labels for variant selection and hand history", () => {
    render(<MainMenuScreen language="ja" />);
    expect(screen.getByRole("button", { name: "ゲームを選択" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ハンド履歴" })).toBeTruthy();
    expect(screen.getByText("キャッシュ・トナメ")).toBeTruthy();
    expect(screen.getByText("保存対応")).toBeTruthy();

    fireEvent.click(screen.getByTestId("menu-variant-select"));
    expect(screen.getByText("ゲームを選択")).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledWith("/games?mode=cash");
  });

  it("notifies when language changes", () => {
    const handleChange = vi.fn();
    render(<MainMenuScreen language="en" onChangeLanguage={handleChange} />);
    fireEvent.click(screen.getByRole("button", { name: /open settings/i }));
    fireEvent.change(screen.getByTestId("language-select"), {
      target: { value: "ja" },
    });
    expect(handleChange).toHaveBeenCalledWith("ja");
  });

  it("shows per-variant Japanese rules and strategy guidance from the help button", () => {
    render(<MainMenuScreen language="ja" />);
    fireEvent.click(screen.getByRole("button", { name: /open rules/i }));

    expect(screen.getByRole("heading", { name: "ゲームルール" })).toBeTruthy();
    expect(screen.getByText("Badugi")).toBeTruthy();
    expect(screen.getAllByText(/4枚すべて違うスート\/ランク/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/強くなるコツ/).length).toBeGreaterThan(0);
    expect(screen.getByText("Pot-Limit Omaha")).toBeTruthy();
    expect(screen.getAllByText(/手札から必ず2枚とボード3枚/).length).toBeGreaterThan(0);
  });
});
