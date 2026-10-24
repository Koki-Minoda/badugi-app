import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "../App.jsx";
import { saveTitleSettings } from "../utils/titleSettings.js";
import { GameEngineProvider } from "../engine/GameEngineContext.jsx";

vi.mock("../state/useAuth.js", () => ({
  useAuth: () => ({
    authState: {
      isAuthenticated: true,
      accessToken: "test-token",
      tokenType: "Bearer",
      user: { id: "hero", username: "Hero", email: "hero@example.com" },
    },
    loginSuccess: () => {},
    logout: () => {},
  }),
}));

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/game"]}>
      <GameEngineProvider gameId="badugi">
        <App />
      </GameEngineProvider>
    </MemoryRouter>,
  );
}

describe("tournament hero bust flow regression", () => {
  let logSpy;
  let warnSpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "test-token",
        tokenType: "Bearer",
        user: { id: "hero", username: "Hero", email: "hero@example.com" },
      }),
    );
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    delete window.__BADUGI_E2E__;
    window.localStorage.clear();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });


  it("preserves hand identity when blinds settle the whole tournament immediately", async () => {
    // A tied random runout legitimately keeps both entrants alive. This
    // fixture needs a decisive winner to exercise immediate tournament end.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderApp();
    fireEvent.click(screen.getByTestId("title-enter-button"));
    await waitFor(() => expect(window.__BADUGI_E2E__?.startTournamentMTT).toBeTypeOf("function"));
    await act(async () => {
      window.__BADUGI_E2E__.startTournamentMTT({
        id: "instant-finish", name: "Instant finish", practiceOnly: true,
        tables: 1, seatsPerTable: 6, totalPlayers: 2, startingStack: 5,
        gameVariant: "nlh", gameRotation: ["nlh"], rotationPolicy: "fixed",
        levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(window.__BADUGI_E2E__.getTournamentHudState().isFinished).toBe(true));
    expect(window.__BADUGI_E2E__.getStateSnapshot().handId).toMatch(/^table-1-h/);
    expect(screen.queryByTestId("hand-result-overlay")).toBeNull();
  });

  it.each([false, true])("keeps a pending deal across profile updates; replaced run=%s", async (replaceRun) => {
    renderApp();
    fireEvent.click(screen.getByTestId("title-enter-button"));
    await waitFor(() => expect(window.__BADUGI_E2E__?.startTournamentMTT).toBeTypeOf("function"));
    const pending = [];
    let firstCallbacks;
    const originalTimeout = window.setTimeout.bind(window);
    const timer = vi.spyOn(window, "setTimeout").mockImplementation((callback, delay, ...args) => {
      if (delay === 0) {
        pending.push(() => callback(...args));
        return 100000 + pending.length;
      }
      return originalTimeout(callback, delay, ...args);
    });
    const config = {
      id: "profile-start", name: "Profile start", practiceOnly: true,
      tables: 1, seatsPerTable: 6, totalPlayers: 6, startingStack: 1000,
      gameVariant: "nlh", gameRotation: ["nlh"], rotationPolicy: "fixed",
    };
    try {
      await act(async () => { window.__BADUGI_E2E__.startTournamentMTT(config); });
      firstCallbacks = pending.splice(0);
      if (replaceRun) {
        await act(async () => { window.__BADUGI_E2E__.startTournamentMTT(config); });
      }
      // This real settings event replaces the immutable tournament state after
      // its initial render, while its first-deal callback is still queued.
      await act(async () => { saveTitleSettings({ playerName: "Renamed Hero" }); });
    } finally {
      timer.mockRestore();
    }
    expect(firstCallbacks.length).toBeGreaterThan(0);
    if (replaceRun) {
      await act(async () => { firstCallbacks.forEach(callback => callback()); });
      expect(window.__BADUGI_E2E__.getStateSnapshot().handCount).toBe(0);
    }
    await act(async () => {
      (replaceRun ? pending : [...firstCallbacks, ...pending]).forEach(callback => callback());
    });
    expect(window.__BADUGI_E2E__.getStateSnapshot().handCount).toBe(1);
    expect(window.__BADUGI_E2E__.getStateSnapshot().handId).toMatch(/^table-1-h1/);
  });

  it("shows the bust overlay and removes the hero from actor flow immediately", async () => {
    renderApp();
    fireEvent.click(screen.getByTestId("title-enter-button"));
    await waitFor(() => {
      expect(screen.getByTestId("menu-tournament")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("menu-tournament"));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId("tournament-start")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("tournament-start"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(window.__BADUGI_E2E__?.forceHeroBust).toBeTypeOf("function");
      expect(
        window.__BADUGI_E2E__.getStateSnapshot().handCount,
      ).toBeGreaterThan(0);
    });

    await act(async () => {
      window.__BADUGI_E2E__.forceHeroBust();
      await Promise.resolve();
    });

    expect(await screen.findByTestId("mtt-hero-bust-overlay")).toBeTruthy();
    expect(screen.queryByText(/Waiting for .*OUT/i)).toBeNull();

    await waitFor(() => {
      const snapshot = window.__BADUGI_E2E__.getStateSnapshot();
      expect(snapshot.phase).toBe("TABLE_FINISHED");
      expect(snapshot.turn).toBeNull();
      expect(snapshot.controllerSnapshot?.turn).toBeNull();
      expect(
        snapshot.controllerSnapshot?.metadata?.actingPlayerIndex,
      ).toBeNull();
    });
  });
});
