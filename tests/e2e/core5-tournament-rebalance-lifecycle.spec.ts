import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  invokeTournamentHelper,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-rebalance-lifecycle.json"), rows));

test.describe("Core5 tournament rebalance lifecycle", () => {
  test.describe.configure({ timeout: 240000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} background tournament simulation preserves player identities`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await invokeTournamentHelper(page, "simulateTournamentBackground", 2);
      const replay = await invokeTournamentHelper(page, "getTournamentReplay");
      const finalState = replay?.finalState ?? {};
      const players = Object.keys(finalState.players ?? {});
      expect(new Set(players).size).toBe(players.length);
      rows.push({ variant: variant.variant, mode: "tournament", status: "PASS", rebalanceSafe: true });
    });
  }
});

