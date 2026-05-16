import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "../authHelper";
import { CORE5_VARIANTS, ensureDirFor } from "./core5LayoutAuditHelper";
import {
  getProgressState,
  playOneHandProgression,
  waitForE2EDriver,
} from "./gameProgressHelper.js";

export { CORE5_VARIANTS };

export function writeLifecycleReport(reportPath: string, rows: unknown[]) {
  ensureDirFor(reportPath);
  const statuses = rows.map((row: any) => row.status);
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

export async function openCore5Cash(page: Page, variant: (typeof CORE5_VARIANTS)[number]) {
  if (variant.requiresPreview) {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.previewVariants", "true");
    });
  }
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.variant}&mode=cash`);
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
}

export async function playCashHand(page: Page, variant: (typeof CORE5_VARIANTS)[number]) {
  const result = await playOneHandProgression(page, {
    maxSteps: variant.maxSteps,
    policy: "safe",
    requireHeroButtonClick: false,
  });
  expect(result.status).toBe("PASS");
  return result;
}

export async function cashOutToSelector(page: Page) {
  await page.getByRole("button", { name: /Cash Out/i }).click();
  const dialog = page.getByRole("dialog", { name: /Cash out result/i });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole("button", { name: /ゲーム選択|Game Select|Select Game/i }).click();
  await expect(page.getByText(/Select Your Variant|ゲームを選択/i)).toBeVisible({ timeout: 20000 });
}

export async function startCore5Tournament(page: Page, variant: (typeof CORE5_VARIANTS)[number]) {
  await openCore5Cash(page, variant);
  await page.waitForFunction(
    () => typeof window.__BADUGI_E2E__?.startTournamentMTT === "function",
    undefined,
    { timeout: 20000 },
  );
  await page.evaluate((variantId) => {
    window.__BADUGI_E2E__.startTournamentMTT({
      id: `core5-lifecycle-${String(variantId).toLowerCase()}`,
      name: "Core5 Lifecycle Gate",
      tables: 1,
      seatsPerTable: 6,
      startingStack: 2000,
      gameVariant: variantId,
      gameRotation: [variantId],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
    });
  }, variant.variant);
  await page.getByTestId("tournament-hud").waitFor({ state: "visible", timeout: 20000 });
}

export async function invokeTournamentHelper(page: Page, method: string, ...params: unknown[]) {
  return page.evaluate(
    async ({ methodName, args }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...args);
    },
    { methodName: method, args: params },
  );
}

export async function fastForwardTournamentComplete(page: Page) {
  await invokeTournamentHelper(page, "fastForwardMTTComplete");
  const heroBust = page.getByTestId("mtt-hero-bust-overlay");
  const result = page.getByTestId("mtt-result-overlay");
  await expect(heroBust.or(result)).toBeVisible({ timeout: 30000 });
}

export async function returnTournamentOverlayToMenu(page: Page) {
  const overlay = page.getByTestId("mtt-hero-bust-overlay").or(page.getByTestId("mtt-result-overlay"));
  await expect(overlay).toBeVisible({ timeout: 20000 });
  await overlay.getByRole("button", { name: /back to menu/i }).click();
  await expect(page.getByTestId("menu-ring")).toBeVisible({ timeout: 20000 });
}

export async function summarizeCurrentProgress(page: Page) {
  const progress = await getProgressState(page);
  return {
    phase: progress.phase,
    actor: progress.actor,
    handId: progress.handId,
    pot: progress.pot,
    players: (progress.players ?? []).map((player: any, seat: number) => ({
      seat,
      stack: player?.stack ?? 0,
      folded: Boolean(player?.folded || player?.hasFolded),
      allIn: Boolean(player?.allIn),
      seatOut: Boolean(player?.seatOut || player?.isBusted),
    })),
  };
}
