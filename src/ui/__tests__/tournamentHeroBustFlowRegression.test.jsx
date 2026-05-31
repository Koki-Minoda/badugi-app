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
    window.localStorage.removeItem("mgx_auth");
    logSpy.mockRestore();
    warnSpy.mockRestore();
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
