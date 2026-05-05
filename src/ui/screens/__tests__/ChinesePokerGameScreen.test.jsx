import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChinesePokerGameScreen from "../ChinesePokerGameScreen.jsx";

describe("ChinesePokerGameScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a playable Chinese Poker setup with 13 hero cards", () => {
    render(<ChinesePokerGameScreen language="en" />);

    expect(screen.getByTestId("chinese-poker-screen")).toBeTruthy();
    expect(screen.getByText("Chinese Poker")).toBeTruthy();
    expect(screen.getByText(/Hand #1/)).toBeTruthy();
    expect(screen.getAllByTestId(/^chinese-card-/).length).toBeGreaterThanOrEqual(13);
  });

  it("can score a hand and advance to the next hand", () => {
    render(<ChinesePokerGameScreen language="en" />);

    fireEvent.click(screen.getByTestId("chinese-submit"));
    expect(screen.getByTestId("chinese-results")).toBeTruthy();
    expect(screen.getByText("Next Hand")).toBeTruthy();

    fireEvent.click(screen.getByTestId("chinese-next-hand"));
    expect(screen.getByText(/Hand #2/)).toBeTruthy();
    expect(screen.queryByTestId("chinese-results")).toBeNull();
  });

  it("returns to game selector through the back action", () => {
    const onBack = vi.fn();
    render(<ChinesePokerGameScreen language="ja" onBack={onBack} />);

    fireEvent.click(screen.getByText("ゲーム選択へ戻る"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
