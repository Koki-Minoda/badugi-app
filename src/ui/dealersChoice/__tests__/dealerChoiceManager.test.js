import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDealerChoiceQueue,
  disableDealerChoiceMode,
  enqueueDealerChoiceVariant,
  getDealerChoiceQueue,
  isDealerChoiceModeActive,
  setDealerChoiceModeActive,
  shiftDealerChoiceVariant,
} from "../../dealersChoice/dealerChoiceManager.js";

function bootstrapStorage() {
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
      clear: () => {
        store.clear();
      },
    },
    CustomEvent: class CustomEvent {
      constructor(name, options = {}) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    dispatchEvent: vi.fn ? vi.fn() : () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  global.CustomEvent = global.window.CustomEvent;
  return store;
}

describe("dealerChoiceManager", () => {
  beforeEach(() => {
    bootstrapStorage();
    clearDealerChoiceQueue();
    setDealerChoiceModeActive(false);
  });

  afterEach(() => {
    delete global.window;
    if (global.CustomEvent) {
      delete global.CustomEvent;
    }
  });

  it("enqueues variants and shifts them with queue metadata", () => {
    enqueueDealerChoiceVariant("D01");
    enqueueDealerChoiceVariant("D02");

    expect(getDealerChoiceQueue()).toEqual(["D01", "D02"]);

    const first = shiftDealerChoiceVariant();
    expect(first).toEqual({
      variantId: "D01",
      remaining: 1,
      queueLengthBefore: 2,
    });

    const second = shiftDealerChoiceVariant();
    expect(second).toEqual({
      variantId: "D02",
      remaining: 0,
      queueLengthBefore: 1,
    });

    const empty = shiftDealerChoiceVariant();
    expect(empty).toEqual({
      variantId: null,
      remaining: 0,
      queueLengthBefore: 0,
    });
  });

  it("clears the queue and toggles mode flags", () => {
    enqueueDealerChoiceVariant("B01");
    expect(getDealerChoiceQueue()).toEqual(["B01"]);
    clearDealerChoiceQueue();
    expect(getDealerChoiceQueue()).toEqual([]);

    setDealerChoiceModeActive(true);
    expect(isDealerChoiceModeActive()).toBe(true);
    setDealerChoiceModeActive(false);
    expect(isDealerChoiceModeActive()).toBe(false);
  });

  it("disables mode and emits event detail", () => {
    const events = [];
    window.dispatchEvent = (evt) => {
      events.push(evt.detail);
    };
    setDealerChoiceModeActive(true);
    expect(isDealerChoiceModeActive()).toBe(true);
    const disabled = disableDealerChoiceMode("tournament");
    expect(disabled).toBe(true);
    expect(isDealerChoiceModeActive()).toBe(false);
    expect(events[0]).toMatchObject({ reason: "tournament" });
  });
});
