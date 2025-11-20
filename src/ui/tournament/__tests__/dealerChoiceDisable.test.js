import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTournamentSession,
  clearActiveTournamentSession,
} from "../../tournament/tournamentManager.js";
import {
  isDealerChoiceModeActive,
  setDealerChoiceModeActive,
} from "../../dealersChoice/dealerChoiceManager.js";

function mockWindow() {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    },
    CustomEvent: class CustomEvent {
      constructor(name, options = {}) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    dispatchEvent: () => {},
  };
  global.CustomEvent = global.window.CustomEvent;
}

describe("tournamentManager Dealer's Choice integration", () => {
  beforeEach(() => {
    mockWindow();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    clearActiveTournamentSession();
    vi.restoreAllMocks();
    delete global.window;
    if (global.CustomEvent) {
      delete global.CustomEvent;
    }
  });

  it("disables Dealer's Choice mode when creating a tournament session", () => {
    setDealerChoiceModeActive(true);
    expect(isDealerChoiceModeActive()).toBe(true);
    createTournamentSession("store", { name: "Tester" });
    expect(isDealerChoiceModeActive()).toBe(false);
  });
});
