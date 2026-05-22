import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/core5");
const SUMMARY_PATH = path.join(REPORT_DIR, "core5-cash-opening-cpu-action-summary.json");

const CORE5 = [
  { variant: "badugi", label: "Badugi" },
  { variant: "D01", label: "2-7 Triple Draw" },
  { variant: "D02", label: "A-5 Triple Draw" },
  { variant: "S01", label: "2-7 Single Draw" },
  { variant: "S02", label: "A-5 Single Draw" },
] as const;

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function openCore5Cash(page: Page, variant: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}&mode=cash&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

function compact(progress: Awaited<ReturnType<typeof getProgressState>>) {
  const snapshot = progress?.snapshot ?? {};
  return {
    handId: progress?.handId ?? null,
    phase: progress?.phase ?? null,
    actor: progress?.actor ?? null,
    drawRoundIndex: progress?.drawRoundIndex ?? null,
    currentBet: progress?.currentBet ?? null,
    pot: progress?.pot ?? null,
    controllerClass: progress?.state?.controllerName ?? null,
    gameVariant: progress?.state?.gameVariant ?? snapshot?.variantId ?? null,
    controllerActor: snapshot?.turn ?? snapshot?.nextTurn ?? snapshot?.currentActor ?? null,
    legalUiActions: progress?.ui?.actions ?? [],
    players: (progress?.players ?? []).map((player, seat) => ({
      seat,
      name: player?.name ?? null,
      stack: Number(player?.stack ?? 0),
      bet: Number(player?.betThisRound ?? player?.bet ?? 0),
      folded: Boolean(player?.folded || player?.hasFolded),
      allIn: Boolean(player?.allIn),
      seatOut: Boolean(player?.seatOut || player?.isBusted),
      lastAction: player?.lastAction ?? null,
      hasActedThisRound: Boolean(player?.hasActedThisRound || player?.actedThisRound),
    })),
  };
}

async function assertOpeningProgresses(page: Page, variant: string) {
  await openCore5Cash(page, variant);

  await invokeE2E(page, "forceDealNewHandNow");
  await page.waitForTimeout(300);
  const initial = await getProgressState(page);

  expect(initial?.phase).toBe("BET");
  expect(initial?.actor, `${variant} opening actor should be elected`).not.toBeNull();

  if (initial.actor === 0) {
    await expect(page.getByTestId("action-call").or(page.getByTestId("action-check"))).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("action-fold").click({ trial: true });
  } else {
    await page.waitForFunction(
      ({ initialActor, initialHandId }) => {
        const api = window.__BADUGI_E2E__;
        const state = api?.getStateSnapshot?.();
        const snapshot = state?.controllerSnapshot ?? {};
        const actor = snapshot?.turn ?? snapshot?.nextTurn ?? state?.turn ?? null;
        const players = snapshot?.players ?? state?.players ?? [];
        const initialActorState = players?.[initialActor];
        return (
          state?.handId !== initialHandId ||
          actor !== initialActor ||
          Boolean(initialActorState?.lastAction) ||
          Boolean(initialActorState?.hasActedThisRound)
        );
      },
      { initialActor: initial.actor, initialHandId: initial.handId },
      { timeout: 8000 },
    );
  }

  const after = await getProgressState(page);
  const failure = await invokeE2E(page, "getLastControllerActionFailure");
  expect(failure, `${variant} controller failure: ${JSON.stringify(failure)}`).toBeNull();
  expect(compact(after)).not.toEqual(compact(initial));

  return {
    variant,
    initial: compact(initial),
    after: compact(after),
  };
}

test.describe("Core5 cash opening CPU actor regression", () => {
  test.describe.configure({ timeout: 120000 });

  test.afterAll(() => {
    ensureReportDir();
  });

  for (const entry of CORE5) {
    test(`${entry.label} opening CPU actor progresses on mobile cash`, async ({ page }) => {
      ensureReportDir();
      const result = await assertOpeningProgresses(page, entry.variant);
      const existing = fs.existsSync(SUMMARY_PATH)
        ? JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"))
        : { generatedAt: new Date().toISOString(), results: [] };
      const results = Array.isArray(existing.results) ? existing.results : [];
      const nextResults = results.filter((row: any) => row.variant !== entry.variant);
      nextResults.push(result);
      fs.writeFileSync(
        SUMMARY_PATH,
        `${JSON.stringify({ generatedAt: new Date().toISOString(), results: nextResults }, null, 2)}\n`,
      );
    });
  }
});
