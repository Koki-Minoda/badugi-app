import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { auditHandReplayFidelity } from "../../src/games/badugi/flow/handReplay.js";
import { validateReplayReadyHandHistory } from "../../src/ui/utils/handHistoryReplayRequirements.js";
import {
  APP_URL,
  deleteAuthenticatedSession,
  openAuthenticatedGame,
} from "./authHelper";
import { CORE5_VARIANTS } from "./helpers/core5LayoutAuditHelper";
import {
  getProgressState,
  summarizeProgressState,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/all-live-cash");
const HANDS = Math.max(10, Number(process.env.MGX_ALL_LIVE_CASH_HANDS ?? 10));
const enabled = process.env.MGX_ALL_LIVE_CASH_QA === "1";
const variantFilter = new Set(
  String(process.env.MGX_ALL_LIVE_CASH_VARIANTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const deviceFilter = new Set(
  String(process.env.MGX_ALL_LIVE_CASH_DEVICES ?? "desktop,android")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const selectedVariants = CORE5_VARIANTS.filter(
  (variant) => variantFilter.size === 0 || variantFilter.has(variant.variant.toLowerCase()),
);

type DeviceName = "desktop" | "android";

function writeReport(fileName: string, value: unknown) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function visibleHeroActions(page: Page) {
  const ids = [
    "action-check",
    "action-call",
    "action-raise",
    "action-fold",
    "action-draw-selected",
  ];
  const visible: string[] = [];
  for (const id of ids) {
    const button = page.getByTestId(id).first();
    if (
      (await button.count()) > 0 &&
      (await button.isVisible().catch(() => false)) &&
      (await button.isEnabled().catch(() => false))
    ) {
      visible.push(id);
    }
  }
  return visible;
}

async function visibleLayoutIssues(page: Page) {
  return page.evaluate(() => {
    const viewport = window.visualViewport ?? {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
    };
    const issues: string[] = [];
    for (const id of [
      "action-check",
      "action-call",
      "action-raise",
      "action-fold",
      "action-draw-selected",
    ]) {
      const element = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
      if (!element || element.offsetParent === null) continue;
      const box = element.getBoundingClientRect();
      const left = viewport.offsetLeft;
      const top = viewport.offsetTop;
      const right = left + viewport.width;
      const bottom = top + viewport.height;
      if (box.left < left || box.right > right || box.top < top || box.bottom > bottom) {
        issues.push(`${id}:outside-visual-viewport`);
      }
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit || (hit !== element && !element.contains(hit))) {
        issues.push(`${id}:center-not-clickable`);
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 2) {
      issues.push(`horizontal-overflow:${document.documentElement.scrollWidth}>${window.innerWidth}`);
    }
    return issues;
  });
}

async function blindSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__BADUGI_E2E__?.getStateSnapshot?.() ?? {};
    const snapshot = state.controllerSnapshot ?? {};
    const displayed = document.querySelector('[data-testid="table-summary-blinds"]')?.textContent ?? "";
    const displayedMatch = displayed.match(/(\d+)\s*:\s*(\d+)\s*\/\s*(\d+)/);
    return {
      level: displayedMatch
        ? Math.max(0, Number(displayedMatch[1]) - 1)
        : Number(snapshot.blindLevelIndex ?? state.blindLevelIndex ?? 0),
      handsInLevel: Number(snapshot.handsInLevel ?? state.handsInLevel ?? 0),
      smallBlind: displayedMatch
        ? Number(displayedMatch[2])
        : Number(snapshot.structure?.sb ?? snapshot.smallBlind ?? state.SB ?? state.smallBlind ?? 0),
      bigBlind: displayedMatch
        ? Number(displayedMatch[3])
        : Number(snapshot.structure?.bb ?? snapshot.bigBlind ?? state.BB ?? state.bigBlind ?? 0),
    };
  });
}

async function playOneRealButtonHand(page: Page, handNumber: number) {
  const deadline = Date.now() + 90_000;
  let heroButtonClicks = 0;
  let drawClicks = 0;
  let steps = 0;
  const phases = new Set<string>();
  while (Date.now() < deadline) {
    const progress = await getProgressState(page);
    phases.add(String(progress.phase));
    if (progress.isTerminal) {
      return {
        heroButtonClicks,
        drawClicks,
        steps,
        phases: [...phases],
        walk: heroButtonClicks === 0,
        terminalProgress: {
          ...summarizeProgressState(progress),
          ui: progress.ui,
          rawPhase: progress.snapshot?.phase ?? progress.phaseState?.phase ?? progress.state?.phase ?? null,
        },
      };
    }
    expect(await visibleLayoutIssues(page), `hand ${handNumber} action layout`).toEqual([]);
    const actions = await visibleHeroActions(page);
    if (actions.length === 0) {
      await page.waitForTimeout(100);
      continue;
    }
    let target: string | undefined;
    if (actions.includes("action-draw-selected")) {
      if (handNumber % 3 === 0) {
        const firstCard = page.getByTestId("player-0-card-0").first();
        if (await firstCard.isVisible().catch(() => false)) {
          await firstCard.click({ timeout: 5_000 });
        }
      }
      target = "action-draw-selected";
      drawClicks += 1;
    } else if (
      handNumber % 5 === 0 &&
      heroButtonClicks === 0 &&
      actions.includes("action-raise")
    ) {
      target = "action-raise";
    } else if (handNumber % 3 !== 0 && actions.includes("action-fold")) {
      target = "action-fold";
    } else {
      target = ["action-check", "action-call", "action-fold", "action-raise"].find((id) =>
        actions.includes(id),
      );
    }
    if (!target) throw new Error(`No real Hero action for hand ${handNumber}: ${actions.join(",")}`);
    await page.getByTestId(target).first().click({ timeout: 5_000 });
    heroButtonClicks += 1;
    steps += 1;
    await page.waitForTimeout(100);
  }
  throw new Error(`Hand ${handNumber} froze before settlement`);
}

async function historyRecords(page: Page) {
  return page.evaluate(() => {
    const memory = window.__BADUGI_E2E__?.getHandHistory?.() ?? [];
    const persisted = (() => {
      try {
        return JSON.parse(window.localStorage.getItem("badugi.history.hands") ?? "[]");
      } catch {
        return [];
      }
    })();
    const seen = new Set<string>();
    return [...persisted, ...memory].filter((record: any) => {
      if (!record?.handId || seen.has(record.handId)) return false;
      seen.add(record.handId);
      return true;
    });
  });
}

async function verifyHistoryAndReplay(
  page: Page,
  expectedHandIds: string[],
  onStage: (stage: string, details?: Record<string, unknown>) => void = () => {},
) {
  onStage("history-records-read-start");
  const records = await historyRecords(page);
  onStage("history-records-read-complete", {
    recordCount: records.length,
    recordSizes: records
      .filter((record: any) => expectedHandIds.includes(record?.handId))
      .map((record: any) => ({
        handId: record?.handId,
        events: record?.events?.length ?? 0,
        actions: (record?.seats ?? []).reduce(
          (sum: number, seat: any) => sum + (seat?.actions?.length ?? 0),
          0,
        ),
      })),
  });
  const selected = expectedHandIds.map((handId) => records.find((record: any) => record?.handId === handId));
  expect(selected.filter(Boolean)).toHaveLength(expectedHandIds.length);
  for (const [index, record] of selected.entries()) {
    onStage("history-record-audit-start", { index, handId: record.handId });
    const ready = validateReplayReadyHandHistory(record, { variantId: record.variantId });
    expect(ready.valid, `history ${record.handId}: ${ready.missing.join(", ")}`).toBe(true);
    const audit = auditHandReplayFidelity(record);
    if (!audit.valid) {
      writeReport(`replay-audit-failure-${String(record.handId).replace(/[^a-z0-9_-]/gi, "_")}.json`, {
        audit,
        record,
      });
    }
    expect(audit.valid, `replay ${record.handId}: ${JSON.stringify(audit.issues)}`).toBe(true);
    onStage("history-record-audit-complete", { index, handId: record.handId });
  }

  const lastHandId = expectedHandIds.at(-1)!;
  onStage("history-ui-open-start", { lastHandId });
  await page.getByTestId("hand-result-history").click({ timeout: 5_000 });
  const modal = page.getByTestId("game-utility-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  onStage("history-ui-open-complete", { lastHandId });
  await expect(modal.getByTestId(`hand-history-row-${lastHandId}`)).toBeVisible();
  await modal.getByTestId(`hand-history-row-${lastHandId}`).click();
  await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 10_000 });
  onStage("replay-ui-open-complete", { lastHandId });
  const counter = page.getByTestId("replay-frame-counter");
  await expect(counter).toContainText(/Frame 1 \/ \d+/, { timeout: 5_000 });
  const counterText = (await counter.textContent()) ?? "";
  const frameCount = Number(counterText.match(/Frame 1 \/ (\d+)/)?.[1] ?? 0);
  expect(frameCount, `replay ${lastHandId} must contain multiple frames`).toBeGreaterThan(1);
  onStage("replay-frame-count-verified", { lastHandId, frameCount });
  const lastFrameButton = page.getByTestId("replay-last-frame");
  await expect(lastFrameButton).toBeEnabled({ timeout: 5_000 });
  await lastFrameButton.click({ force: true, timeout: 5_000 });
  onStage("replay-last-frame-clicked", { lastHandId, frameCount });
  await expect(page.getByText(/Awarded pot:/)).toBeVisible({ timeout: 10_000 });
  onStage("replay-settlement-verified", { lastHandId, frameCount });
  await page.getByRole("button", { name: /Back to History/i }).click();
  await expect(page.getByTestId("hand-result-overlay")).toBeVisible({ timeout: 10_000 });
  onStage("replay-ui-complete", { lastHandId });
  return { records: selected.length, replayedHandId: lastHandId };
}

async function createDevicePage(browser: Browser, device: DeviceName) {
  const context = await browser.newContext(
    device === "android"
      ? {
          viewport: { width: 844, height: 390 },
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
          userAgent:
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        }
      : { viewport: { width: 1440, height: 900 } },
  );
  return { context, page: await context.newPage() };
}

async function runVariant(browser: Browser, variant: (typeof CORE5_VARIANTS)[number], device: DeviceName) {
  const { context, page } = await createDevicePage(browser, device);
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()}:${response.request().method()}:${response.url()}`);
    }
  });
  let session: Awaited<ReturnType<typeof openAuthenticatedGame>> | null = null;
  const rows: unknown[] = [];
  const mark = (stage: string, details: Record<string, unknown> = {}) =>
    writeReport(`${variant.variant.toLowerCase()}-${device}-progress.json`, {
      generatedAt: new Date().toISOString(),
      stage,
      rows,
      ...details,
    });
  try {
    mark("opening-game");
    session = await openAuthenticatedGame(
      page,
      `${APP_URL}?variant=${variant.variant}&mode=cash&mgxQa=mobile`,
    );
    await waitForE2EDriver(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 30_000 });
    const openingBlind = await blindSnapshot(page);
    const openingHistory = await historyRecords(page);
    const openingHistoryCount = openingHistory.length;
    const openingHistoryIds = new Set(openingHistory.map((record: any) => record.handId));
    const handIds: string[] = [];
    let totalDrawClicks = 0;
    let totalHeroButtonClicks = 0;
    for (let hand = 1; hand <= HANDS; hand += 1) {
      mark("hand-start", { hand });
      await expect(page.getByTestId("hand-result-overlay")).toBeHidden({ timeout: 15_000 });
      const before = await getProgressState(page);
      expect(before.handId).toEqual(expect.any(String));
      const result = await playOneRealButtonHand(page, hand);
      mark("hand-reported-terminal", { hand, result });
      totalDrawClicks += result.drawClicks;
      totalHeroButtonClicks += result.heroButtonClicks;
      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => (await historyRecords(page)).length, { timeout: 15_000 })
        .toBeGreaterThanOrEqual(openingHistoryCount + hand);
      const finalizedHistory = await historyRecords(page);
      const finalizedHandId = String(
        finalizedHistory.find(
          (record: any) =>
            !openingHistoryIds.has(record?.handId) && !handIds.includes(record?.handId),
        )?.handId ?? "",
      );
      expect(finalizedHandId).not.toBe("");
      handIds.push(finalizedHandId);
      rows.push({
        hand,
        controllerHandId: before.handId,
        handId: finalizedHandId,
        blind: await blindSnapshot(page),
        terminal: summarizeProgressState(await getProgressState(page)),
        ...result,
      });
      mark("hand-complete", { hand, finalizedHandId });
      if (hand < HANDS) {
        const next = page.getByTestId("hand-result-next-hand");
        await expect(next).toBeVisible({ timeout: 10_000 });
        await next.click({ timeout: 5_000 });
        await expect(page.getByTestId("hand-result-overlay")).toBeHidden({ timeout: 15_000 });
        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20_000 });
      }
    }
    expect(
      totalHeroButtonClicks,
      `${variant.displayName} must exercise real Hero buttons across the session`,
    ).toBeGreaterThanOrEqual(Math.ceil(HANDS / 2));
    expect(totalDrawClicks, `${variant.displayName} must exercise Draw`).toBeGreaterThan(0);
    const closingBlind = await blindSnapshot(page);
    expect(closingBlind.level, `${variant.displayName} blind level must rise within ${HANDS} hands`).toBeGreaterThan(
      openingBlind.level,
    );
    expect(closingBlind.bigBlind, `${variant.displayName} big blind must rise`).toBeGreaterThan(openingBlind.bigBlind);
    mark("history-audit-start", { handIds });
    const history = await verifyHistoryAndReplay(page, handIds, mark);
    mark("history-audit-complete", { history });

    mark("cash-out-start");
    await page.getByTestId("hand-result-cash-out").click();
    const cashOut = page.getByRole("dialog", { name: /Cash out result/i });
    await expect(cashOut).toBeVisible({ timeout: 15_000 });
    await expect(cashOut.getByText(String(HANDS), { exact: true })).toBeVisible();
    await cashOut.getByRole("button", { name: /ゲーム選択|Game Select/i }).click();
    await expect(page.getByText(/Select Your Variant|ゲームを選択/i)).toBeVisible({ timeout: 20_000 });
    mark("cash-out-complete");

    const relevantErrors = browserErrors.filter(
      (entry) =>
        !/Failed to load resource.*404|favicon|ResizeObserver loop|onnxruntime.*Unknown CPU vendor/i.test(
          entry,
        ),
    );
    const relevantResponses = failedResponses.filter(
      (entry) => !/404:GET:.+\/characters\/.+\.png/.test(entry),
    );
    mark("final-browser-check", { relevantErrors, relevantResponses });
    expect(relevantErrors).toEqual([]);
    expect(relevantResponses).toEqual([]);
    return {
      status: "PASS",
      variant: variant.variant,
      displayName: variant.displayName,
      device,
      handsCompleted: HANDS,
      nextHandClicks: HANDS - 1,
      openingBlind,
      closingBlind,
      totalDrawClicks,
      totalHeroButtonClicks,
      history,
      cashOut: true,
      rows,
    };
  } finally {
    if (session) await deleteAuthenticatedSession(page, session);
    await context.close();
  }
}

test.describe("all publicly playable Core5 cash production gate", () => {
  test.skip(!enabled, "MGX_ALL_LIVE_CASH_QA=1 is required");
  test.describe.configure({ mode: "serial", timeout: 20 * 60_000 });

  for (const variant of selectedVariants) {
    for (const device of ["desktop", "android"] as const) {
      if (!deviceFilter.has(device)) continue;
      test(`${variant.displayName} ${device} completes ${HANDS} real-button hands`, async ({ browser }) => {
        try {
          const report = await runVariant(browser, variant, device);
          writeReport(`${variant.variant.toLowerCase()}-${device}-${HANDS}-hands.json`, report);
        } catch (error) {
          writeReport(`${variant.variant.toLowerCase()}-${device}-failure.json`, {
            generatedAt: new Date().toISOString(),
            variant: variant.variant,
            device,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      });
    }
  }
});
