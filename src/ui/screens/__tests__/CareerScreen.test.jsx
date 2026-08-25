import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CareerScreen from "../CareerScreen.jsx";

const championProfile = {
  version: 1,
  unlockedVariants: ["badugi", "2-7td"],
  completedTournaments: [
    {
      variant: "badugi",
      stage: "store",
      stageId: "store",
      finishPlace: 1,
      prize: 1000,
      completedAt: 100,
    },
    {
      variant: "badugi",
      stage: "local",
      stageId: "local",
      finishPlace: 1,
      prize: 2000,
      completedAt: 200,
    },
  ],
  achievements: [
    {
      id: "champion-badugi-store",
      type: "stageChampion",
      variant: "badugi",
      stage: "store",
      label: "Badugi Store Tournament Champion",
      achievedAt: 100,
    },
  ],
  statistics: {
    tournamentsPlayed: 2,
    tournamentsWon: 2,
    finalTables: 2,
    headsUps: 2,
    totalPrize: 3000,
  },
};

describe("CareerScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the career screen with progress map", () => {
    render(<CareerScreen profile={championProfile} />);

    expect(screen.getByRole("heading", { name: "BADUGI SERIES" })).toBeTruthy();
    expect(screen.getByTestId("career-progress-map").textContent).toContain(
      "Store Tournament",
    );
    expect(screen.getByTestId("career-stage-store").textContent).toContain("DONE");
    expect(screen.getByTestId("career-stage-national").textContent).toContain("OPEN");
  });

  it("renders statistics and variant availability", () => {
    render(<CareerScreen profile={championProfile} />);

    expect(screen.getByTestId("career-statistics").textContent).toContain(
      "Tournaments Played",
    );
    expect(screen.getByTestId("career-statistics").textContent).toContain("3,000");
    expect(screen.getByTestId("career-variant-badugi").textContent).toContain(
      "PLAYABLE",
    );
    expect(screen.getByTestId("career-variant-2-7td").textContent).toContain(
      "PLAYABLE",
    );
    expect(screen.getByTestId("career-variant-a5td").textContent).toContain(
      "LOCKED",
    );
  });

  it("renders champion records", () => {
    render(<CareerScreen profile={championProfile} />);

    expect(screen.getByTestId("career-champion-record").textContent).toContain(
      "Badugi Store Tournament Champion",
    );
  });
});
