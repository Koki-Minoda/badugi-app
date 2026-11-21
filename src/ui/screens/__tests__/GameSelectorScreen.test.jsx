import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameSelectorScreen from "../GameSelectorScreen.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("GameSelectorScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Japanese variant descriptions when language is ja", () => {
    render(<GameSelectorScreen language="ja" />);

    expect(screen.getByText("ゲームを選択")).toBeTruthy();
    expect(screen.getByText(/ストレートとフラッシュが弱点になる2-7ロー/)).toBeTruthy();
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.queryByText("検証中")).toBeNull();
    expect(screen.queryByText("Triple-draw 2-7 lowball using three draws and fixed-limit betting streets.")).toBeNull();
    expect(screen.queryByText("すぐに開始できるゲーム")).toBeNull();
  });

  it("shows one public status per game without internal IDs or QA metadata", () => {
    render(<GameSelectorScreen language="ja" />);
    const card = within(screen.getByTestId("game-selector-card-deuce_to_seven_triple_draw"));
    expect(card.getAllByText("Alpha")).toHaveLength(1);
    expect(card.queryByText("D01")).toBeNull();
    expect(card.queryByText(/優先フェーズ|QA|評価|Renderer/)).toBeNull();
    expect(card.getByRole("button").disabled).toBe(false);
  });

  it("renders English variant descriptions when language is en", () => {
    render(<GameSelectorScreen language="en" />);

    expect(screen.getByText("Select Your Variant")).toBeTruthy();
    expect(screen.getByText("Triple-draw 2-7 lowball using three draws and fixed-limit betting streets.")).toBeTruthy();
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.queryByText("Preview")).toBeNull();
    expect(screen.queryByText(/ストレートとフラッシュが弱点になる2-7ロー/)).toBeNull();
    expect(screen.queryByText("Start a Cash Game")).toBeNull();
  });

  it("renders the filtered game cards immediately after search controls", () => {
    render(<GameSelectorScreen language="ja" />);

    const searchSection = screen.getByPlaceholderText("ゲームを検索...").closest("section");
    const firstGameCard = screen.getByTestId("game-selector-card-deuce_to_seven_triple_draw");
    const advancedMode = screen.getByText("Mixed Game").closest("section");

    expect(searchSection.compareDocumentPosition(firstGameCard)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(firstGameCard.compareDocumentPosition(advancedMode)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("passes a selected Badugi Beginner cash tier through the normal launch", () => {
    const onLaunchVariant = vi.fn();
    render(<GameSelectorScreen language="ja" onLaunchVariant={onLaunchVariant} />);
    fireEvent.change(screen.getByTestId("badugi-cash-tier"), { target: { value: "beginner" } });
    fireEvent.click(screen.getByTestId("game-selector-play-badugi"));
    expect(onLaunchVariant).toHaveBeenCalledWith("badugi", { cashTierId: "beginner" });
  });

  it("passes a selected Badugi Pro cash tier through the normal launch", () => {
    const onLaunchVariant = vi.fn();
    render(<GameSelectorScreen language="ja" onLaunchVariant={onLaunchVariant} />);
    fireEvent.change(screen.getByTestId("badugi-cash-tier"), { target: { value: "pro" } });
    fireEvent.click(screen.getByTestId("game-selector-play-badugi"));
    expect(onLaunchVariant).toHaveBeenCalledWith("badugi", { cashTierId: "pro" });
  });
});
