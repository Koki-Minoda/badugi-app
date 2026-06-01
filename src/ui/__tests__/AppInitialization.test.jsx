
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "../App.jsx";
import { GameEngineProvider } from "../engine/GameEngineContext.jsx";
import { STORAGE_KEYS } from "../../storage/keys.js";

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/game"]}>
      <GameEngineProvider gameId="badugi">
        <App />
      </GameEngineProvider>
    </MemoryRouter>
  );
}

describe("App smoke test", () => {
  afterEach(() => {
    cleanup();
    delete window.__BADUGI_E2E__;
    window.localStorage.clear();
  });

  it("mounts without runtime or console errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      expect(() => renderApp()).not.toThrow();

      const problematicLogs = [...errorSpy.mock.calls, ...warnSpy.mock.calls].filter(
        ([message]) => {
          const normalized = message instanceof Error ? message.message : String(message ?? "");
          return /Internal React error|Expected corresponding JSX closing tag/i.test(normalized);
        }
      );

      expect(errorSpy).toHaveBeenCalledTimes(0);
      expect(problematicLogs).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("syncs E2E tournament stage wins to consolidated progress v2", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      renderApp();
      await waitFor(() => {
        expect(window.__BADUGI_E2E__?.recordTournamentStageWin).toBeTypeOf(
          "function",
        );
      });

      window.__BADUGI_E2E__.recordTournamentStageWin("local");

      const legacy = JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.TOURNAMENT_PROGRESS),
      );
      const v2 = JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.TOURNAMENT_V2),
      );

      expect(legacy.wins.local).toBe(1);
      expect(v2.tournament.stageWins.local).toBe(1);
      expect(v2.tournament.lastResult).toMatchObject({
        stageId: "local",
        finishPlace: 1,
        prize: 0,
      });
      expect(v2.tournament.completedTournaments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: "local",
            finishPlace: 1,
            tournamentId: "local-e2e-stage-win",
          }),
        ]),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
