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
    const fallbackImage = avatar.querySelector("img");
    if (fallbackImage) fireEvent.error(fallbackImage);
    expect(avatar.textContent).toBe("A");
  });

  test("renders character images when only avatarUrl survives table hydration", () => {
    render(
      <Player
        player={{ ...basePlayer, avatar: "default_avatar", avatarUrl: "/characters/akira.png" }}
        index={2}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="BB"
      />,
    );

    const image = screen.getByTestId("seat-2-avatar").querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("/characters/akira.png");
  });

  test("recovers CPU character images from roster metadata when avatar fields are missing", () => {
    render(
      <Player
        player={{
          ...basePlayer,
          name: "Sora",
          avatar: "default_avatar",
          avatarUrl: null,
          isCPU: true,
          cpuStyle: "loose-aggressive",
        }}
        index={3}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="UTG"
      />,
    );

    const image = screen.getByTestId("seat-3-avatar").querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("/characters/sora.png");
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

  test("keeps non-hero draw cards face down before showdown", () => {
    render(
      <Player
        player={{ ...basePlayer, showHand: false }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="BB"
        displayVariant="badugi"
      />,
    );

    const opponentCards = [
      screen.getByTestId("player-1-card-0"),
      screen.getByTestId("player-1-card-1"),
      screen.getByTestId("player-1-card-2"),
      screen.getByTestId("player-1-card-3"),
    ];
    opponentCards.forEach((card) => {
      expect(card.textContent).not.toContain("A");
      expect(card.textContent).not.toContain("2");
      expect(card.textContent).not.toContain("3");
      expect(card.textContent).not.toContain("4");
    });
  });

  test("reveals only Stud up-cards for non-hero seats before showdown", () => {
    render(
      <Player
        player={{
          ...basePlayer,
          hand: ["AS", "KD", "2C"],
          cardVisibility: ["down", "down", "up"],
          showHand: false,
        }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        positionLabel="UTG"
        displayVariant="stud"
      />,
    );

    expect(screen.getByTestId("player-1-card-0").textContent).not.toContain("A");
    expect(screen.getByTestId("player-1-card-1").textContent).not.toContain("K");
    expect(screen.getByTestId("player-1-card-2").textContent).toContain("2♣");
  });

  test("reveals non-hero draw cards when showdown marks showHand", () => {
    render(
      <Player
        player={{ ...basePlayer, showHand: true }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="SHOWDOWN"
        positionLabel="BB"
        displayVariant="badugi"
      />,
    );

    expect(screen.getByTestId("player-1-card-0").textContent).toContain("A♣");
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

  test("labels Stud up-cards and down-cards so exposed cards are clear", () => {
    render(
      <Player
        player={{
          ...basePlayer,
          hand: ["AS", "KD", "2C", "7H"],
          cardVisibility: ["down", "down", "up", "up"],
          showHand: true,
        }}
        index={0}
        selfIndex={0}
        turn={1}
        dealerIdx={1}
        phase="BET"
        positionLabel="BTN"
        displayVariant="stud"
      />,
    );

    expect(screen.getByTestId("player-0-card-0-visibility").textContent).toBe("HOLE");
    expect(screen.getByTestId("player-0-card-2-visibility").textContent).toBe("VISIBLE");
    expect(screen.getByTestId("player-0-card-0-down-slot").className).toContain("translate-y-1");
    expect(screen.getByTestId("player-0-card-2-up-slot").className).toContain("-translate-y-2");
    expect(screen.getByTestId("seat-0-stud-summary").textContent).toContain("Visible 2");
    expect(screen.getByTestId("seat-0-stud-summary").textContent).toContain("Down 2");
  });

  test("renders Stud hero down-cards with a diagonal back overlay instead of text-only labels", () => {
    render(
      <Player
        player={{
          ...basePlayer,
          hand: ["AS", "KD", "2C"],
          cardVisibility: ["down", "down", "up"],
          showHand: true,
        }}
        index={0}
        selfIndex={0}
        turn={1}
        dealerIdx={1}
        phase="BET"
        positionLabel="BTN"
        displayVariant="stud"
      />,
    );

    const downCard = screen.getByTestId("player-0-card-0");
    expect(downCard.querySelector('[style*="polygon"]')).toBeTruthy();
    expect(screen.getByTestId("player-0-card-2").querySelector('[style*="polygon"]')).toBeNull();
  });

  test("marks seventh street down card and bring-in / complete actions clearly", () => {
    const { rerender } = render(
      <Player
        player={{
          ...basePlayer,
          hand: ["AS", "KD", "2C", "7H", "8S", "9D", "3C"],
          cardVisibility: ["down", "down", "up", "up", "up", "up", "down"],
          showHand: true,
          lastAction: "Bring-in 5",
        }}
        index={0}
        selfIndex={0}
        turn={1}
        dealerIdx={1}
        phase="BET"
        positionLabel="BTN"
        displayVariant="stud"
      />,
    );

    expect(screen.getByTestId("player-0-card-6-visibility").textContent).toBe("7TH DOWN");
    expect(screen.getByTestId("seat-0-stud-summary").textContent).toContain("7th down");
    expect(screen.getByTestId("stud-action-badge").textContent).toContain("Bring-in 5");

    rerender(
      <Player
        player={{
          ...basePlayer,
          hand: ["AS", "KD", "2C", "7H", "8S", "9D", "3C"],
          cardVisibility: ["down", "down", "up", "up", "up", "up", "down"],
          showHand: true,
          lastAction: "Complete",
        }}
        index={0}
        selfIndex={0}
        turn={1}
        dealerIdx={1}
        phase="BET"
        positionLabel="BTN"
        displayVariant="razz"
      />,
    );

    expect(screen.getByTestId("stud-action-badge").textContent).toBe("Complete");
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

  test("shows a compact draw badge from lastDrawCount", () => {
    render(
      <Player
        player={{ ...basePlayer, lastDrawCount: 2 }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        compact
      />,
    );

    expect(screen.getByTestId("seat-1-draw-badge").textContent).toBe("D2");
  });

  test("shows PAT compact draw badge for zero-card draws", () => {
    render(
      <Player
        player={{ ...basePlayer, lastDrawCount: 0 }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        compact
      />,
    );

    expect(screen.getByTestId("seat-1-draw-badge").textContent).toBe("PAT");
  });

  test("parses compact draw badge from lastAction when lastDrawCount is missing", () => {
    render(
      <Player
        player={{ ...basePlayer, lastAction: "DRAW(3)" }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        compact
      />,
    );

    expect(screen.getByTestId("seat-1-draw-badge").textContent).toBe("D3");
  });

  test("keeps non-compact last action text visible", () => {
    render(
      <Player
        player={{ ...basePlayer, lastAction: "DRAW(2)" }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
      />,
    );

    expect(screen.getByText("[DRAW(2)]")).toBeTruthy();
    expect(screen.queryByTestId("seat-1-draw-badge")).toBeNull();
  });

  test("does not show compact draw badges for folded or out players", () => {
    const { rerender } = render(
      <Player
        player={{ ...basePlayer, lastDrawCount: 2, folded: true }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        compact
      />,
    );

    expect(screen.queryByTestId("seat-1-draw-badge")).toBeNull();

    rerender(
      <Player
        player={{ ...basePlayer, lastDrawCount: 2, seatOut: true }}
        index={1}
        selfIndex={0}
        turn={0}
        dealerIdx={0}
        phase="BET"
        compact
      />,
    );

    expect(screen.queryByTestId("seat-1-draw-badge")).toBeNull();
  });
});
