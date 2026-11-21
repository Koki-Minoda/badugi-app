
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "../App.jsx";
import { GameEngineProvider } from "../engine/GameEngineContext.jsx";
import { STORAGE_KEYS } from "../../storage/keys.js";

function renderApp(url = "/game") {
  return render(
    <MemoryRouter initialEntries={[url]}>
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
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it("starts a selected cash link after auth hydration and returns to the menu without relaunching", async () => {
    const url = "/game?variant=badugi&aiTier=beginner";
    window.history.replaceState(null, '', url);
    window.localStorage.setItem("mgx_auth", JSON.stringify({
      accessToken: "qa-token", tokenType: "Bearer",
      user: { id: 123, username: "QA" }, isAuthenticated: true,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ id: 123, username: "QA" }),
    })));
    renderApp(url);
    await screen.findByRole("button", { name: "精算して退出" });
    expect(screen.queryByRole("button", { name: "登録・ログイン" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "精算して退出" }));
    fireEvent.click(screen.getByRole("button", { name: "ゲーム選択", exact: true }));
    await screen.findByRole("button", { name: "キャッシュゲーム", exact: true });
    expect(screen.queryByRole("button", { name: "精算して退出" })).toBeNull();
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
