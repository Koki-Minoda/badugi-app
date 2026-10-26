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

    expect(screen.getByText("Select a card, then choose a row.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("chinese-submit"));
    expect(screen.getByTestId("chinese-results")).toBeTruthy();
    const resultPosition = screen.getByTestId("chinese-results")
      .compareDocumentPosition(screen.getByTestId("chinese-hero-arrange"));
    expect(resultPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("chinese-replay-integrity").textContent).toContain("verified");
    expect(screen.getByTestId("chinese-history-replay").textContent).toContain("ROWS_SET");
    expect(screen.getByText("Next Hand")).toBeTruthy();
    expect(screen.getByText("The rows and score are final. Review each row and the result.")).toBeTruthy();
    expect(screen.queryByText("Select a card, then choose a row.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Auto Arrange" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear Rows" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Front 3" })).toBeNull();
    expect(screen.queryByText("Unassigned Cards")).toBeNull();

    fireEvent.click(screen.getByTestId("chinese-next-hand"));
    expect(screen.getByText(/Hand #2/)).toBeTruthy();
    expect(screen.queryByTestId("chinese-results")).toBeNull();
    expect(screen.getByRole("button", { name: "Auto Arrange" })).toBeTruthy();
    expect(screen.getByText("Select a card, then choose a row.")).toBeTruthy();
  }, 10000);

  it("does not duplicate the row-set history event after auto arrange", () => {
    render(<ChinesePokerGameScreen language="en" />);

    fireEvent.click(screen.getByText("Auto Arrange"));
    fireEvent.click(screen.getByTestId("chinese-submit"));

    const history = screen.getByTestId("chinese-history-replay").textContent;
    expect(history.match(/ROWS_SET/g)).toHaveLength(1);
    expect(screen.getByTestId("chinese-replay-integrity").textContent).toContain("verified");
  }, 10000);

  it("returns to game selector through the back action", () => {
    const onBack = vi.fn();
    render(<ChinesePokerGameScreen language="ja" onBack={onBack} />);

    fireEvent.click(screen.getByText("ゲーム選択へ戻る"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
