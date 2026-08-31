import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  APP_URL,
  deleteAuthenticatedSession,
  openAuthenticatedGame,
} from "./authHelper";
import {
  getProgressState,
  summarizeProgressState,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/production-cash");
const isCashQaRun = Boolean(
  process.env.MGX_CASH_QA === "1" ||
    process.env.E2E_APP_URL ||
    process.env.LIVE_PREVIEW === "1",
);
const desktopHandCount = Number(process.env.MGX_CASH_DESKTOP_HANDS ?? 30);
const androidHandCount = Number(process.env.MGX_CASH_ANDROID_HANDS ?? 20);
const isLocalDevRun = (() => {
  try {
    const hostname = new URL(APP_URL).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
})();

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function visibleLayoutIssues(page: Page) {
  return page.evaluate(() => {
    const viewport = window.visualViewport ?? {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
    };
    const actionIds = [
      "action-check",
      "action-call",
      "action-raise",
      "action-fold",
      "action-draw-selected",
    ];
    const issues: string[] = [];
    for (const testId of actionIds) {
      const element = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
      if (!element || element.offsetParent === null) continue;
      const box = element.getBoundingClientRect();
      const left = viewport.offsetLeft;
      const top = viewport.offsetTop;
      const right = left + viewport.width;
      const bottom = top + viewport.height;
      if (box.left < left || box.right > right || box.top < top || box.bottom > bottom) {
        issues.push(`${testId}:outside-visual-viewport`);
      }
      const x = Math.min(Math.max(box.left + box.width / 2, left), right - 1);
      const y = Math.min(Math.max(box.top + box.height / 2, top), bottom - 1);
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== element && !element.contains(hit))) {
        issues.push(`${testId}:center-not-clickable`);
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 2) {
      issues.push(`horizontal-overflow:${document.documentElement.scrollWidth}>${window.innerWidth}`);
    }
    return issues;
  });
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

async function driveHandLikePlayer(page: Page, hand: number) {
  const startedAt = Date.now();
  const trace: unknown[] = [];
  let heroButtonClicks = 0;
  let drawClicks = 0;
  let selectedDrawCard = false;
  let consecutiveTransientClickRetries = 0;

  while (Date.now() - startedAt < 90_000) {
    const resultVisible = await page
      .getByText("Hand Result")
      .first()
      .isVisible()
      .catch(() => false);
    if (resultVisible) {
      return { trace, heroButtonClicks, drawClicks };
    }

    const actions = await visibleHeroActions(page);
    const snapshot = summarizeProgressState(await getProgressState(page));
    trace.push({ elapsedMs: Date.now() - startedAt, actions, snapshot });
    expect(await visibleLayoutIssues(page), `hand ${hand} live layout`).toEqual([]);

    if (actions.length === 0) {
      await page.waitForTimeout(100);
      continue;
    }

    let target: string | undefined;
    if (actions.includes("action-draw-selected")) {
      if (hand % 3 === 0 && !selectedDrawCard) {
        const firstCard = page.getByTestId("player-0-card-0").first();
        if (await firstCard.isVisible().catch(() => false)) {
          await firstCard.click({ timeout: 5_000 });
          selectedDrawCard = true;
        }
      }
      target = "action-draw-selected";
    } else if (hand % 5 === 0 && actions.includes("action-raise")) {
      target = "action-raise";
    } else {
      target = ["action-check", "action-call", "action-fold", "action-raise"].find((id) =>
        actions.includes(id),
      );
    }

    if (!target) throw new Error(`No playable Hero action: ${JSON.stringify({ hand, actions, trace })}`);
    try {
      await page.getByTestId(target).first().click({ timeout: 1_000 });
      consecutiveTransientClickRetries = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transientDomChange = /detached from the DOM|intercepts pointer events/i.test(message);
      consecutiveTransientClickRetries += 1;
      trace.push({
        elapsedMs: Date.now() - startedAt,
        clickRetry: {
          target,
          latestActions: await visibleHeroActions(page),
          attempt: consecutiveTransientClickRetries,
        },
      });
      if (!transientDomChange || consecutiveTransientClickRetries > 5) throw error;
      expect(await visibleLayoutIssues(page), `hand ${hand} transient action replacement`).toEqual([]);
      await page.waitForTimeout(50);
      continue;
    }
    if (target === "action-draw-selected") drawClicks += 1;
    heroButtonClicks += 1;
    await page.waitForTimeout(100);
  }

  throw new Error(
    `Visible game froze before Hand Result: ${JSON.stringify({ hand, trace: trace.slice(-20) })}`,
  );
}

async function runHands(page: Page, handCount: number) {
  const rows: unknown[] = [];
  const browserErrors: string[] = [];
  const controllerWarnings: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
    if (
      message.type() === "warning" &&
      /\[(CTRL|E2E|SESSION_CONTROLLER|BLOCK)/.test(message.text())
    ) {
      controllerWarnings.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()}:${response.request().method()}:${response.url()}`);
    }
  });

  const session = await openAuthenticatedGame(
    page,
    `${APP_URL}?variant=badugi&mode=cash&mgxQa=mobile`,
  );
  try {
    await waitForE2EDriver(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 30_000 });

    for (let hand = 1; hand <= handCount; hand += 1) {
      const before = await getProgressState(page);
      expect(await visibleLayoutIssues(page), `hand ${hand} initial layout`).toEqual([]);

      const result = await driveHandLikePlayer(page, hand);

      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 15_000 });
      rows.push({
        hand,
        before: summarizeProgressState(before),
        terminal: summarizeProgressState(await getProgressState(page)),
        steps: result.trace.length,
        heroButtonClicks: result.heroButtonClicks,
        drawClicks: result.drawClicks,
      });

      const nextHand = page.getByRole("button", { name: /next hand/i }).first();
      await expect(nextHand).toBeVisible({ timeout: 10_000 });
      await nextHand.click({ timeout: 5_000 });
      await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 15_000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20_000 });
    }

    const unexpectedResponses = failedResponses.filter(
      (entry) =>
        !(
          isLocalDevRun &&
          /404:GET:http:\/\/(?:127\.0\.0\.1|localhost):\d+\/characters\/.+\.png$/.test(entry)
        ),
    );
    const unexpectedBrowserErrors = browserErrors.filter(
      (entry) =>
        !(
          isLocalDevRun &&
          entry === "console:Failed to load resource: the server responded with a status of 404 (Not Found)"
        ) && !/\[W:onnxruntime:.*Unknown CPU vendor/i.test(entry),
    );
    const rejectedPlayerActions = controllerWarnings.filter((entry) => entry.startsWith("[CTRL]"));
    expect(unexpectedResponses).toEqual([]);
    expect(unexpectedBrowserErrors).toEqual([]);
    expect(rejectedPlayerActions, "visible player actions must not be rejected by the controller").toEqual([]);
    return { rows, browserErrors, controllerWarnings, failedResponses };
  } catch (error) {
    ensureReportDir();
    fs.writeFileSync(
      path.join(REPORT_DIR, `failure-${Date.now()}.json`),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          rows,
          browserErrors,
          controllerWarnings,
          failedResponses,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
    );
    throw error;
  } finally {
    await deleteAuthenticatedSession(page, session);
  }
}

test.describe("production cash playability", () => {
  test.skip(!isCashQaRun, "MGX_CASH_QA=1, E2E_APP_URL, or LIVE_PREVIEW=1 is required");
  test.describe.configure({ timeout: 15 * 60_000 });

  test(`desktop completes ${desktopHandCount} real-button Badugi hands`, async ({ page }) => {
    ensureReportDir();
    await page.setViewportSize({ width: 1440, height: 900 });
    const report = await runHands(page, desktopHandCount);
    fs.writeFileSync(
      path.join(REPORT_DIR, `desktop-${desktopHandCount}-hands.json`),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`,
    );
  });

  test(`Android landscape completes ${androidHandCount} real-button Badugi hands`, async ({ browser }) => {
    ensureReportDir();
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    try {
      const report = await runHands(page, androidHandCount);
      fs.writeFileSync(
        path.join(REPORT_DIR, `android-landscape-${androidHandCount}-hands.json`),
        `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`,
      );
    } finally {
      await context.close();
    }
  });
});
