import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/badugi");
const TRACE_PATH = path.join(REPORT_DIR, "badugi-cash-opening-actor-trace.jsonl");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-cash-opening-actor-summary.json");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function appendTrace(row: unknown) {
  ensureReportDir();
  fs.appendFileSync(TRACE_PATH, `${JSON.stringify({ timestamp: Date.now(), ...row })}\n`);
}

async function openBadugiCash(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=cash&mgxQa=mobile`);
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
    })),
  };
}

test("Badugi cash opening actor applies or exposes hero controls without freezing", async ({ page }) => {
  test.setTimeout(120000);
  ensureReportDir();
  fs.writeFileSync(TRACE_PATH, "");
  await openBadugiCash(page);

  await invokeE2E(page, "forceDealNewHandNow");
  await page.waitForTimeout(300);
  const initial = await getProgressState(page);
  appendTrace({ step: "initial", progress: compact(initial), debug: await invokeE2E(page, "getControllerDebug") });

  expect(initial?.phase).toBe("BET");
  expect(initial?.actor, "opening actor should be elected").not.toBeNull();

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
  const debugAfter = await invokeE2E(page, "getControllerDebug");
  appendTrace({ step: "after-opening-progress", progress: compact(after), failure, debug: debugAfter });
  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), initial: compact(initial), after: compact(after), failure, debugAfter }, null, 2)}\n`,
  );

  expect(failure, `controller failure: ${JSON.stringify(failure)}`).toBeNull();
  expect(after?.phase).toBeTruthy();
  expect(compact(after)).not.toEqual(compact(initial));
  expect(debugAfter?.sessionHandId ?? after?.snapshot?.handId ?? after?.handId).toBeTruthy();
});
