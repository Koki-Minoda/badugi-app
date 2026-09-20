import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TournamentHubScreen from "../TournamentHubScreen.jsx";
import { saveActiveMTTSnapshot } from "../../tournament/tournamentManager.js";
import {
  createDefaultConsolidatedProgress,
  saveConsolidatedProgress,
} from "../../utils/consolidatedProgress.js";

describe("TournamentHubScreen", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders the Badugi Series hub from tournament definitions", () => {
    render(<TournamentHubScreen />);

    expect(screen.getByRole("heading", { name: "BADUGI SERIES" })).toBeTruthy();
    expect(screen.getAllByText(/store tournament/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/local tournament/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/national championship/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/world championship/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beginner Circuit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Regional Series").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI: Standard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI: Pro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI: Iron").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI: WorldMaster").length).toBeGreaterThan(0);
    expect(screen.getByTestId("variant-unlock-badugi").textContent).toContain(
      "遊べます",
    );
    expect(screen.getByTestId("variant-unlock-2-7td").textContent).toContain(
      "参加条件あり",
    );
  });

  it("shows Store detail and starts Store config", () => {
    const handleStart = vi.fn();
    render(<TournamentHubScreen onStartTournament={handleStart} />);

    fireEvent.click(screen.getByTestId("tournament-stage-store"));
    expect(screen.getByTestId("tournament-stage-detail").textContent).toContain(
      "Store Tournament",
    );
    expect(screen.getByTestId("tournament-stage-detail").textContent).toContain(
      "参加人数",
    );
    expect(screen.getByTestId("tournament-stage-detail").textContent).toContain(
      "500",
    );

    fireEvent.click(screen.getByTestId("tournament-start"));
    expect(handleStart).toHaveBeenCalledTimes(1);
    expect(handleStart.mock.calls[0][0]).toMatchObject({
      id: "store-mtt",
      stageId: "store",
      name: "Store Tournament",
      totalPlayers: 18,
      tables: 3,
      startingStack: 500,
      blindSheetId: "store-standard",
    });
  });

  it.each([
    ["local", "local-mtt", "Pro", { store: 1 }, 1_000],
    ["national", "national-mtt", "Iron", { local: 1 }, 3_000],
    ["world", "world-mtt", "WorldMaster", { national: 2 }, 7_500],
  ])("starts %s config from the selected detail", (stageId, configId, tierLabel, stageWins, bankroll) => {
    const handleStart = vi.fn();
    render(
      <TournamentHubScreen
        progress={{ stageWins, bankroll, completedTournaments: [] }}
        onStartTournament={handleStart}
      />,
    );

    fireEvent.click(screen.getByTestId(`tournament-stage-${stageId}`));
    expect(screen.getByTestId("tournament-stage-detail").textContent).toContain(
      tierLabel,
    );
    fireEvent.click(screen.getByTestId("tournament-start"));

    expect(handleStart).toHaveBeenCalledTimes(1);
    expect(handleStart.mock.calls[0][0]).toMatchObject({
      id: configId,
      stageId,
      gameVariant: "badugi",
    });
    expect(handleStart.mock.calls[0][0].levels.length).toBeGreaterThan(0);
  });

  it("blocks upper stages until both the win requirement and entry fee are met", () => {
    const handleStart = vi.fn();
    render(<TournamentHubScreen onStartTournament={handleStart} />);

    fireEvent.click(screen.getByTestId("tournament-stage-world"));
    expect(screen.getByTestId("tournament-stage-detail").textContent).toContain(
      "全国優勝が2回必要",
    );
    expect(screen.getByTestId("tournament-start").disabled).toBe(true);
    fireEvent.click(screen.getByTestId("tournament-start"));
    expect(handleStart).not.toHaveBeenCalled();
  });

  it("shows COMING SOON and blocks start when a stage has no playable config", () => {
    const handleStart = vi.fn();
    const stages = [
      {
        id: "missing",
        tournamentName: "Missing Tournament",
        seriesLabel: "Future Series",
        blindSheetId: "missing-sheet",
        tableSize: 6,
        startingStack: 500,
      },
    ];
    render(<TournamentHubScreen stages={stages} onStartTournament={handleStart} />);

    expect(screen.getAllByText(/準備中/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("tournament-start").disabled).toBe(true);
    fireEvent.click(screen.getByTestId("tournament-start"));
    expect(handleStart).not.toHaveBeenCalled();
  });

  it("shows future variants as playable after the required championship", () => {
    render(
      <TournamentHubScreen
        progress={{
          completedTournaments: [
            { variant: "badugi", stage: "world", finishPlace: 1 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("variant-unlock-2-7td").textContent).toContain(
      "遊べます",
    );
  });

  it("uses consolidated v2 completed tournaments for unlock evaluation", () => {
    const defaults = createDefaultConsolidatedProgress();
    saveConsolidatedProgress({
      ...defaults,
      tournament: {
        ...defaults.tournament,
        completedTournaments: [
          { variant: "badugi", stage: "world", finishPlace: 1 },
        ],
      },
    });

    render(<TournamentHubScreen />);

    expect(screen.getByTestId("variant-unlock-2-7td").textContent).toContain(
      "遊べます",
    );
  });

  it("shows resume and retire controls for an active saved tournament", () => {
    const handleResume = vi.fn();
    const snapshot = {
      version: 1,
      config: { name: "Store Tournament" },
      tournamentState: {
        isFinished: false,
        playersRemaining: 12,
        players: {
          "hero-player": { id: "hero-player", stack: 500, busted: false },
        },
      },
      hero: { playerId: "hero-player" },
    };
    render(
      <TournamentHubScreen
        activeSnapshot={snapshot}
        onResumeTournament={handleResume}
      />,
    );

    expect(screen.getByTestId("tournament-resume-panel").textContent).toContain(
      "大会を再開",
    );
    fireEvent.click(screen.getByTestId("tournament-resume"));
    expect(handleResume).toHaveBeenCalledWith(snapshot);
  });

  it("shows resume controls when an active snapshot exists in storage", () => {
    saveActiveMTTSnapshot({
      version: 1,
      config: { name: "Store Tournament" },
      tournamentState: {
        isFinished: false,
        playersRemaining: 10,
        players: {
          "hero-player": { id: "hero-player", stack: 500, busted: false },
        },
      },
      hero: { playerId: "hero-player" },
    });

    render(<TournamentHubScreen />);

    expect(screen.getByTestId("tournament-resume-panel").textContent).toContain(
      "大会を再開",
    );
  });

  it("retire clears the active resume panel", () => {
    const snapshot = {
      version: 1,
      config: { name: "Store Tournament" },
      tournamentState: {
        isFinished: false,
        playersRemaining: 12,
        players: {
          "hero-player": { id: "hero-player", stack: 500, busted: false },
        },
      },
      hero: { playerId: "hero-player" },
    };
    render(<TournamentHubScreen activeSnapshot={snapshot} />);

    fireEvent.click(screen.getByTestId("tournament-retire"));
    expect(screen.queryByTestId("tournament-resume-panel")).toBeNull();
  });
});
