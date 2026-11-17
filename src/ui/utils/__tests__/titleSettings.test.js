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

  test.each(["player@example.com", "  player+mixed@example.com  "])("does not expose account email %s as a playing name", (email) => {
    expect(resolveHeroPlayerName("You", email)).toBe("You");
    expect(resolveHeroPlayerName("", email)).toBe("You");
    expect(resolveHeroPlayerName("Koki", email)).toBe("Koki");
    expect(resolveHeroPlayerName(email, email)).toBe("You");
    expect(resolveHeroPlayerName(email, "Mixed Master")).toBe("Mixed Master");
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
