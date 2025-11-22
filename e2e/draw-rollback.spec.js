import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "tests", "logs");
const LOG_FILE = path.join(LOG_DIR, `playwright-${Date.now()}.log`);

function appendLog(line) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`, { encoding: "utf8" });
}

async function drainE2ETrace(page, label = "e2e") {
  try {
    const trace = await page.evaluate(() => {
      const helper = window.__BADUGI_E2E__;
      return {
        logs:
          typeof helper?.drainLogs === "function"
            ? helper.drainLogs()
            : typeof helper?.captureConsole === "function"
            ? helper.captureConsole()
            : [],
        phaseState:
          typeof helper?.getPhaseState === "function"
            ? helper.getPhaseState()
            : null,
      };
    });

    if (trace.phaseState) {
      appendLog(`${label} phaseState ${JSON.stringify(trace.phaseState)}`);
    }
    (trace.logs || []).forEach((entry) => {
      appendLog(`${label} ${entry}`);
    });
  } catch (error) {
    appendLog(`${label} drain failed: ${error?.message ?? error}`);
  }
}

async function openGame(page) {
  await page.goto("http://localhost:3000/");
  const translateBubble = page.locator("text=Google Translate");
  if (await translateBubble.count()) {
    await translateBubble.click().catch(() => {});
  }
  const closeButtons = page.locator("button:has-text(\"閉じる\")");
  if (await closeButtons.count()) {
    await closeButtons.first().click().catch(() => {});
  }
  const startButton = page.getByRole("button", { name: /start/i }).first();
  await startButton.waitFor({ state: "visible", timeout: 15000 });
  await startButton.click();
  const reachedGame = await Promise.race([
    page.waitForURL("**/game*", { timeout: 10000 }).then(() => "game"),
    page.waitForURL("**/menu*", { timeout: 10000 }).then(() => "menu"),
  ]);
  if (reachedGame === "menu") {
    await page.goto("http://localhost:3000/game", { waitUntil: "load" });
  }
  await page.getByRole("button", { name: /Leaderboard/i }).first().waitFor({ state: "visible", timeout: 12000 });
}

test("Draw progress never rolls back across successive draws", async ({ page }) => {
  const finishLogs = [];
  let finishResolver;
  const finishPromise = new Promise((resolve) => {
    finishResolver = resolve;
  });
  page.on("console", (msg) => {
    if (msg.text().includes("[TRACE] finishDrawRound start")) {
      finishLogs.push(msg.text());
      if (finishLogs.length >= 3) finishResolver();
    }
  });

  await openGame(page);
  try {
    let attempts = 0;
    while (finishLogs.length < 3 && attempts < 10) {
      const drawButton = page.getByRole("button", { name: /draw selected/i }).first();
      try {
        await drawButton.click();
      } catch {
        // ignore if not enabled yet
      }
      appendLog(`draw-sel attempt ${attempts}`);
      await page.waitForTimeout(1500);
      attempts += 1;
    }

    await Promise.race([
      finishPromise,
      page.waitForTimeout(60000).then(() => {
        throw new Error("Timeout waiting for finishDrawRound logs");
      }),
    ]);

    const rounds = finishLogs.map((log) => {
      const match = log.match(/drawRound:\s*(\d+)/);
      return match ? Number(match[1]) : -1;
    });
    appendLog(`draw rounds captured: ${JSON.stringify(rounds)}`);
    expect(rounds).toContain(1);
    expect(rounds).toContain(2);
    expect(rounds).toContain(3);
  } finally {
    await drainE2ETrace(page, "draw-progress");
  }
});

test("Hero with Badugi is reported as showdown winner", async ({ page }) => {
  const showdownLogs = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[SHOWDOWN] Winners")) {
      showdownLogs.push(msg.text());
    }
  });

  await openGame(page);
  try {
    await page.evaluate(() => {
      const helper = window.__BADUGI_E2E__;
      if (!helper) return;
      [1, 2, 3, 4, 5].forEach((seat) => helper.simulateBust(seat));
    });

    await page.getByRole("button", { name: /(Check|Call|Fold)/i }).first().click();
    appendLog("hero fold for showdown");
    await page.waitForSelector("text=Hand Result", { timeout: 20000 });
    const heroEntry = page.getByText("You", { exact: true }).nth(0);
    await expect(heroEntry).toBeVisible();
  } finally {
    await drainE2ETrace(page, "hero-showdown");
  }
});

test("Repeated fold-only hands stay responsive", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const handLogs = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[TRACE] dealNewHand START")) {
      handLogs.push(msg.text());
    }
  });

  await openGame(page);
  const foldButton = page.getByRole("button", { name: /fold/i });

  const waitForNextHandLog = (prevCount) =>
    new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (handLogs.length > prevCount) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (Date.now() - start > 20000) {
          clearInterval(interval);
          reject(new Error("timeout waiting for new hand log"));
        }
      }, 250);
    });

  try {
    for (let i = 0; i < 10; i += 1) {
      await foldButton.waitFor({ state: "visible", timeout: 15000 });
      await foldButton.click();
      appendLog(`fold-only loop ${i}`);
      await page.waitForTimeout(500);
    }
    appendLog("fold-only loop completed");
    expect(consoleErrors).toEqual([]);
  } finally {
    await drainE2ETrace(page, "fold-loop");
  }
});
