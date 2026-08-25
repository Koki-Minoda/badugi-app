import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressState,
  invokeE2E,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/browser-gameplay");
const SCREENSHOT_DIR = path.resolve("reports/screenshots");
const SUMMARY_PATH = path.join(REPORT_DIR, "stepb-sd-late-hand-draw-terminal-divergence.json");
const MERGE_TRACE_PATH = path.join(REPORT_DIR, "stepb-snapshot-merge-source-trace.jsonl");

const VARIANTS = [
  { variant: "S01", game: "2-7 Single Draw" },
  { variant: "S02", game: "A-5 Single Draw" },
] as const;

function ensureDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureDir();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeJsonl(filePath: string, rows: unknown[]) {
  ensureDir();
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

async function traceMergeSource(page: Page, label: string) {
  return page.evaluate((traceLabel) => window.__MGX_TRACE_SNAPSHOT_MERGE_SOURCE__?.({ label: traceLabel }) ?? null, label);
}

async function openVariant(page: Page, variantId: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

function playerBet(player: any) {
  return Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0;
}

function choosePayload(progress: any, step: number) {
  const phase = String(progress?.phase ?? "").toUpperCase();
  const actor = progress?.actor;
  const player = typeof actor === "number" ? progress?.players?.[actor] : null;
  if (phase === "DRAW") {
    const handLength = Array.isArray(player?.hand) ? player.hand.length : 5;
    const discardCount = step % 3 === 0 ? 0 : Math.min(handLength, (step % Math.max(1, handLength)) + 1);
    return { type: "draw", discardIndexes: Array.from({ length: discardCount }, (_, index) => index) };
  }
  const toCall = Math.max(0, Number(progress?.currentBet ?? 0) - playerBet(player));
  if (step % 11 === 0 && toCall === 0) return { type: "raise", amount: 20 };
  if (step % 13 === 0 && typeof actor === "number" && actor !== 0 && toCall > 0) return { type: "fold" };
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

async function applyPayload(page: Page, progress: any, payload: any) {
  const actor = progress?.actor;
  if (typeof actor !== "number") return { acted: false, actor, payload, reason: "no-actor" };
  if (actor === 0) {
    const legal = await getLegalActions(page);
    const preferred =
      payload.type === "draw"
        ? ["action-draw-selected"]
        : payload.type === "raise"
          ? ["action-raise", "action-call", "action-check", "action-fold"]
          : payload.type === "fold"
            ? ["action-fold", "action-call", "action-check"]
            : payload.type === "call"
              ? ["action-call", "action-check", "action-fold"]
              : ["action-check", "action-call", "action-fold"];
    const testId = preferred.find((id) => legal.includes(id));
    if (testId) {
      await page.getByTestId(testId).first().click();
      return { acted: true, actor, payload, clickedAction: testId };
    }
  }
  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot && payload.type === "draw" && payload.discardIndexes?.length) {
    snapshot = await invokeE2E(page, "forceControllerAction", actor, { type: "draw", discardIndexes: [] });
  }
  if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  if (!snapshot) {
    await waitForProgressChange(page, progressKey(progress), { timeout: 3000 }).catch(() => {});
    const after = await getProgressState(page);
    if (progressKey(after) !== progressKey(progress)) {
      return { acted: true, actor, payload, clickedAction: "auto-progress" };
    }
  }
  return { acted: Boolean(snapshot), actor, payload, clickedAction: `controller:${payload.type}` };
}

const summaryRows: any[] = [];
const mergeRows: any[] = [];

test.describe("Single Draw late-hand draw/terminal UI divergence", () => {
  test.afterAll(() => {
    writeJson(SUMMARY_PATH, {
      generatedAt: new Date().toISOString(),
      status: summaryRows.some((row) => row.status === "FAIL") ? "FAIL" : "PASS",
      rows: summaryRows,
    });
    writeJsonl(MERGE_TRACE_PATH, mergeRows);
  });

  for (const variant of VARIANTS) {
    test(`${variant.game} hides hero controls when canonical actor is non-hero`, async ({ page }) => {
      await openVariant(page, variant.variant);
      const trace: any[] = [];
      let status = "PASS";
      let failure: any = null;

      for (let step = 0; step < 120; step += 1) {
        const progress = await getProgressState(page);
        const mergeSource = await traceMergeSource(page, `${variant.variant}-step-${step}`);
        if (mergeSource) mergeRows.push(mergeSource);
        const legal = await getLegalActions(page);
        const row = { step, progress: summarizeProgressState(progress), legal, mergeSource };
        trace.push(row);

        if (progress?.isTerminal) {
          expect(legal, "terminal/next-hand must not expose hero action controls").toEqual([]);
          break;
        }

        if (typeof progress?.actor === "number" && progress.actor !== 0) {
          const retryLegal = legal.length ? await page.waitForTimeout(250).then(() => getLegalActions(page)) : legal;
          if (retryLegal.length > 0) {
            status = "FAIL";
            failure = { reason: "hero controls visible for non-hero canonical actor", row, retryLegal };
            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, `stepb-sd-late-hand-${variant.variant}-nonhero-controls.png`),
              fullPage: true,
            });
            break;
          }
        }

        const beforeKey = progressKey(progress);
        const payload = choosePayload(progress, step + 1);
        const acted = await applyPayload(page, progress, payload);
        if (!acted.acted) {
          status = "FAIL";
          failure = { reason: "action application failed", row, payload, acted };
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `stepb-sd-late-hand-${variant.variant}-action-failed.png`),
            fullPage: true,
          });
          break;
        }
        await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => {});
      }

      summaryRows.push({ variantId: variant.variant, status, failure, trace: trace.slice(-12) });
      expect(status, JSON.stringify({ variant: variant.variant, failure, tail: trace.slice(-8) }, null, 2)).toBe("PASS");
    });
  }
});
