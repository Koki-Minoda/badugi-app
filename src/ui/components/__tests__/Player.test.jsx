import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import Player from "../Player.jsx";

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
});
