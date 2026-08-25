import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../keys.js";
import {
  isStorageAvailable,
  safeGetItem,
  safeParseJson,
  safeRemoveItem,
  safeSetItem,
} from "../core.js";
import { isQuotaExceededError } from "../quota.js";
import { validateTournamentV2 } from "../schemas.js";

function createMemoryStorage({ failSet = false } = {}) {
  const values = new Map();
  return {
    getItem: vi.fn((key) => (values.has(key) ? values.get(key) : null)),
    setItem: vi.fn((key, value) => {
      if (failSet) {
        const error = new DOMException("quota exceeded", "QuotaExceededError");
        throw error;
      }
      values.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
    clear: vi.fn(() => values.clear()),
  };
}

function createTournamentV2(overrides = {}) {
  return {
    version: 2,
    tournament: {
      bankroll: 0,
      stageWins: { store: 0, local: 0, national: 0, world: 0 },
      completedTournaments: [],
      lastResult: null,
      history: [],
    },
    career: {
      unlockedVariants: ["badugi"],
      achievements: [],
      statistics: {
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        finalTables: 0,
        headsUps: 0,
        totalPrize: 0,
      },
      worldChampionship: {
        cleared: false,
        firstClearTimestamp: null,
        clearCount: 0,
        lastUnlockPopupAt: null,
      },
    },
    rivals: {},
    _meta: {
      migratedFrom: [],
      migratedAt: null,
      legacyKeysRetained: true,
    },
    ...overrides,
  };
}

describe("storage core", () => {
  it("safeParseJson parses valid JSON", () => {
    expect(safeParseJson('{"ok":true}', null)).toEqual({ ok: true });
  });

  it("safeParseJson returns fallback for invalid JSON", () => {
    expect(safeParseJson("{bad json", { fallback: true })).toEqual({
      fallback: true,
    });
  });

  it("safeGetItem reads JSON values", () => {
    const storage = createMemoryStorage();
    storage.setItem("payload", JSON.stringify({ value: 7 }));

    expect(safeGetItem("payload", null, { storage })).toEqual({ value: 7 });
  });

  it("safeSetItem stores JSON values", () => {
    const storage = createMemoryStorage();

    expect(safeSetItem("payload", { value: 9 }, { storage })).toBe(true);
    expect(storage.getItem("payload")).toBe('{"value":9}');
  });

  it("supports raw mode for strings", () => {
    const storage = createMemoryStorage();

    expect(safeSetItem("raw", "plain text", { storage, raw: true })).toBe(true);
    expect(safeGetItem("raw", null, { storage, raw: true })).toBe("plain text");
  });

  it("does not throw when storage is unavailable", () => {
    expect(safeGetItem("missing", "fallback", { storage: null })).toBe(
      "fallback",
    );
    expect(safeSetItem("missing", { ok: true }, { storage: null })).toBe(false);
    expect(isStorageAvailable(null)).toBe(false);
  });

  it("safeRemoveItem removes values", () => {
    const storage = createMemoryStorage();
    storage.setItem("payload", "1");

    expect(safeRemoveItem("payload", { storage })).toBe(true);
    expect(storage.getItem("payload")).toBeNull();
  });

  it("detects quota errors", () => {
    expect(isQuotaExceededError(new DOMException("full", "QuotaExceededError"))).toBe(
      true,
    );
    expect(isQuotaExceededError({ name: "OtherError", code: 22 })).toBe(true);
    expect(isQuotaExceededError(new Error("network"))).toBe(false);
  });

  it("validateTournamentV2 accepts version 2 schema", () => {
    expect(validateTournamentV2(createTournamentV2())).toBe(true);
  });

  it("schema validators reject invalid payloads", () => {
    expect(validateTournamentV2({ version: 2 })).toBe(false);
    expect(validateTournamentV2(createTournamentV2({ version: 1 }))).toBe(false);
  });

  it("defines the tournament v2 key", () => {
    expect(STORAGE_KEYS.TOURNAMENT_V2).toBe("mgx.tournament.v2");
  });
});
