import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import {
  CORE5_VARIANTS,
  fastForwardTournamentComplete,
  invokeTournamentHelper,
  returnTournamentOverlayToMenu,
  startCore5Tournament,
} from "../helpers/core5LifecycleE2EHelper";
import { visibleBox } from "../helpers/core5LayoutAuditHelper";

export { CORE5_VARIANTS };

export type TournamentIntegrationRow = Record<string, unknown> & {
  variant: string;
  category: string;
  status: "PASS" | "FAIL" | "WARN";
};

export function writeTournamentIntegrationReport(reportPath: string, rows: TournamentIntegrationRow[]) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const statuses = rows.map((row) => row.status);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: statuses.includes("FAIL") ? "FAIL" : statuses.includes("WARN") ? "WARN" : "PASS",
        rows,
      },
      null,
      2,
    )}\n`,
  );
}

export async function startVariantTournament(page: Page, variant: (typeof CORE5_VARIANTS)[number]) {
  await startCore5Tournament(page, variant);
  const hud = await getHud(page);
  expect(hud?.playersRemaining).toBeGreaterThan(1);
  expect(hud?.currentBlinds?.bb).toBeGreaterThan(0);
  return hud;
}

export async function getHud(page: Page) {
  return invokeTournamentHelper(page, "getTournamentHudState") as Promise<any>;
}

export async function finishTournamentAndReturn(page: Page) {
  await fastForwardTournamentComplete(page);
  const placements = await invokeTournamentHelper(page, "getTournamentPlacements") as any[];
  expect(Array.isArray(placements)).toBe(true);
  expect(placements.length).toBeGreaterThan(0);
  const replay = await invokeTournamentHelper(page, "getTournamentReplay").catch(() => null);
  await returnTournamentOverlayToMenu(page);
  return { placements, replay };
}

export async function expectTournamentHudVisible(page: Page) {
  await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("table-total-pot")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("table-phase-badge")).toBeVisible({ timeout: 20000 });
}

export async function collectHudBoxes(page: Page) {
  return {
    hud: await visibleBox(page, "tournament-hud"),
    decisionPanel: await visibleBox(page, "decision-panel"),
    pot: await visibleBox(page, "table-total-pot"),
    phase: await visibleBox(page, "table-phase-badge"),
    table: await visibleBox(page, "game-table-surface"),
  };
}

export function reportPath(name: string) {
  return path.resolve("reports/tournament", `${name}.json`);
}
