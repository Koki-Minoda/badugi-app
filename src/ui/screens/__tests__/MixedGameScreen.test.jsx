import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MixedGameScreen from "../MixedGameScreen.jsx";
import { PRO_MIXED_PRESETS } from "../../../config/mixed/proPresets.js";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../hooks/usePlayerProgress.js", () => ({
  usePlayerProgress: () => ({
    tournament: { wins: { store: 1, regional: 1, world: 1 } },
  }),
}));

vi.mock("../../mixed/useMixedGame.js", () => ({
  useMixedGame: () => ({
    profiles: [
      {
        id: "test-mix",
        name: "Test Mix",
        formatLabel: "Test Mix",
        selectedGameIds: ["D03"],
        selectionMode: "FIXED",
        handsPerGame: 4,
        allowDuplicates: true,
      },
    ],
    saveProfile: vi.fn((profile) => ({
      ...profile,
      id: profile.id || "saved-profile",
      selectedGameIds: profile.selectedGameIds ?? ["D03"],
    })),
    deleteProfile: vi.fn(),
    activateProfile: vi.fn(() => ({ gameId: "D03" })),
    proPresets: PRO_MIXED_PRESETS,
    activeProfileId: null,
    isVariantPlayable: (gameId) => ["D03", "D01", "B05"].includes(gameId),
  }),
}));

function renderScreen(language = "ja") {
  return render(
    <MemoryRouter>
      <MixedGameScreen language={language} />
    </MemoryRouter>,
  );
}

describe("MixedGameScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Japanese preset and variant descriptions before the preset section", () => {
    renderScreen("ja");

    const searchHeading = screen.getByText("ローテーションに入れるゲームを探す");
    const presetHeading = screen.getByText("プロ仕様プリセット");
    expect(searchHeading.compareDocumentPosition(presetHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText(/ストレートとフラッシュが弱点になる2-7ロー/)).toBeTruthy();
    expect(screen.getByText(/HORSE形式の5ゲームを固定順で回す/)).toBeTruthy();
    expect(screen.queryByText("5-game fixed-limit rotation used in pro series.")).toBeNull();
  });

  it("keeps English copy when language is en", () => {
    renderScreen("en");

    expect(screen.getByText("Find Games for the Rotation")).toBeTruthy();
    expect(screen.getByText("5-game fixed-limit rotation used in pro series.")).toBeTruthy();
    expect(screen.getByText("Triple Draw")).toBeTruthy();
  });
});
