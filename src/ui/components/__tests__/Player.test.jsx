import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Player from "../Player.jsx";
import { getDisplayCards } from "../../utils/cardDisplayOrder.js";

const basePlayer = {
  name: "Akira",
  avatar: "/characters/akira.png",
  stack: 500,
  betThisRound: 0,
  hand: ["AC", "2D", "3H", "4S"],
  showHand: false,
};

describe("Player", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders character avatar images and falls back to initials if the image is missing", () => {
    render(
      <Player
        player={basePlayer}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="SB"
      />,
    );

    const avatar = screen.getByTestId("seat-1-avatar");
    const image = avatar.querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("/characters/akira.png");

    if (image) fireEvent.error(image);
    expect(avatar.textContent).toBe("A");
  });

  test("keeps hero draw cards clickable without opening the Smart HUD over the hand", () => {
    const handleCardClick = vi.fn();
    render(
      <Player
        player={{ ...basePlayer, showHand: true }}
        index={0}
        selfIndex={0}
        turn={0}
        dealerIdx={1}
        phase="DRAW"
        positionLabel="SB"
        canSelectForDraw
        onCardClick={handleCardClick}
      />,
    );

    fireEvent.mouseEnter(screen.getByTestId("seat-0"));
    expect(screen.queryByTestId("seat-0-detail")).toBeNull();

    fireEvent.click(screen.getByTestId("player-0-card-0"));
    expect(handleCardClick).toHaveBeenCalledWith(0);
  });

  test("groups paired draw cards visually while preserving original discard indexes", () => {
    const handleCardClick = vi.fn();
    render(
      <Player
        player={{ ...basePlayer, hand: ["QS", "5D", "TC", "5H", "5C"], showHand: true }}
        index={0}
        selfIndex={0}
        turn={0}
        dealerIdx={1}
        phase="DRAW"
        positionLabel="SB"
        canSelectForDraw
        onCardClick={handleCardClick}
      />,
    );

    const visibleCards = screen.getAllByRole("button").map((card) => card.textContent);
    expect(visibleCards.slice(0, 3)).toEqual(["5♦5♦", "5♥5♥", "5♣5♣"]);

    fireEvent.click(screen.getByTestId("player-0-card-3"));
    expect(handleCardClick).toHaveBeenCalledWith(3);
  });

  test("adds Stud and Razz scopes to the Smart HUD game selector", () => {
    render(
      <Player
        player={{ ...basePlayer, stats: { hands: 20, vpipRate: 0.25, pfrRate: 0.1 } }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="MP"
      />,
    );

    fireEvent.mouseEnter(screen.getByTestId("seat-1"));
    const detail = screen.getByTestId("seat-1-detail");
    const scope = within(detail).getByRole("combobox", { name: /hud game scope/i });
    expect(within(scope).getByRole("option", { name: "Stud" })).toBeTruthy();
    expect(within(scope).getByRole("option", { name: "Razz" })).toBeTruthy();
  });

  test("preserves Stud/Razz card order so up-card visibility indexes stay aligned", () => {
    expect(
      getDisplayCards(["QS", "JD", "9C", "2H"], { displayVariant: "razz" }).map(
        ({ card, sourceIndex }) => `${sourceIndex}:${card}`,
      ),
    ).toEqual(["0:QS", "1:JD", "2:9C", "3:2H"]);
  });

  test("sorts lowball and high-card variants with variant-specific ace handling", () => {
    expect(
      getDisplayCards(["5D", "AS", "2C", "7H", "3S"], {
        displayVariant: "deuce_to_seven_triple_draw",
      }).map(({ card }) => card),
    ).toEqual(["AS", "7H", "5D", "3S", "2C"]);

    expect(
      getDisplayCards(["5D", "AS", "2C", "7H", "3S"], {
        displayVariant: "ace_to_five_triple_draw",
      }).map(({ card }) => card),
    ).toEqual(["AS", "2C", "3S", "5D", "7H"]);

    expect(
      getDisplayCards(["KD", "AS", "2C", "QH"], {
        displayVariant: "nl_holdem",
      }).map(({ card }) => card),
    ).toEqual(["AS", "KD", "QH", "2C"]);
  });
});
