
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "../App.jsx";
import { GameEngineProvider } from "../engine/GameEngineContext.jsx";

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
});
