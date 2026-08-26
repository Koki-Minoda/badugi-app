import { afterEach, describe, expect, test } from "vitest";
import {
  loadTitleSettings,
  resolveHeroPlayerName,
} from "../titleSettings.js";

describe("resolveHeroPlayerName", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  test("uses the authenticated username when the local name is still the default placeholder", () => {
    expect(resolveHeroPlayerName("You", "Koki")).toBe("Koki");
  });

  test("keeps an explicitly configured player name ahead of the account username", () => {
    expect(resolveHeroPlayerName("Midnight Badugi", "Koki")).toBe(
      "Midnight Badugi",
    );
  });

  test("does not let a previously persisted default You override the authenticated username", () => {
    window.localStorage.setItem(
      "badugi.titleSettings",
      JSON.stringify({ playerName: "You" }),
    );

    expect(
      resolveHeroPlayerName(loadTitleSettings().playerName, "Koki"),
    ).toBe("Koki");
  });

  test("falls back safely when profile values are missing or whitespace", () => {
    expect(resolveHeroPlayerName("   ", "  account-player  ")).toBe(
      "account-player",
    );
    expect(resolveHeroPlayerName(null, null)).toBe("You");
  });
});
