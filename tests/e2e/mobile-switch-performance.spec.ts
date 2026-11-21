import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  APP_URL,
  openAuthenticatedGame,
  deleteAuthenticatedSession,
  selectGameVariantFromSelector,
  enterTitleIfPresent,
} from "./authHelper";
import {
  waitForE2EDriver,
  playOneHandProgression,
} from "./helpers/gameProgressHelper.js";
import { installMobilePerformanceProbe } from "./helpers/mobilePerformanceProbe";
const BADEUCEY = "badeucey_triple_draw";
const CYCLES = Number(process.env.MGX_PERF_CYCLES ?? 4);
const RUN = process.env.MGX_PERF_RUN ?? "production-baseline";

test("repeated mobile switches and resume retain their response times", async ({
  page,
  browserName,
  context,
}, info) => {
  test.setTimeout(1800000);
  const folder = path.resolve(
    "reports/mobile-performance",
    RUN,
    info.project.name,
  );
  fs.mkdirSync(folder, { recursive: true });
  const rows: any[] = [];
  let cycle = -1;
  let leg = "setup";
  const persist = (kind: string, data: any) => {
    const row = { at: new Date().toISOString(), cycle, leg, kind, ...data };
    rows.push(row);
    fs.appendFileSync(
      path.join(folder, "measurements.jsonl"),
      JSON.stringify(row) + "\n",
    );
  };
  await page.addInitScript(installMobilePerformanceProbe);
  await page.addInitScript(() =>
    localStorage.setItem("mgx.handResult.autoNext", "off"),
  );
  if (browserName === "chromium" && process.env.MGX_PERF_CPU_RATE) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: Number(process.env.MGX_PERF_CPU_RATE),
    });
  }
  page.on("pageerror", (error) =>
    persist("page-error", { message: error.message }),
  );
  const collect = async () => {
    const data = await page.evaluate(() => window.__MGX_PERF__.read());
    persist("probe", data);
  };
  const timed = async (name: string, action: () => Promise<unknown>) => {
    const start = performance.now();
    await action();
    persist("transition", { name, ms: performance.now() - start });
  };
  const ready = async (variant: string) => {
    await expect(page.getByTestId("decision-panel")).toBeVisible({
      timeout: 20000,
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__BADUGI_E2E__.getStateSnapshot().gameVariant,
        ),
      )
      .toBe(variant);
  };
  const hand = async () => {
    const start = performance.now();
    let last = performance.now();
    const result = await playOneHandProgression(page, {
      maxSteps: 180,
      autoCpu: true,
      requireHeroButtonClick: true,
      onStep: ({ step, progress }) => {
        const now = performance.now();
        persist("progress", {
          step,
          phase: progress.phase,
          actor: progress.actor,
          observedWaitMs: now - last,
        });
        last = now;
      },
    });
    expect(result.status).toBe("PASS");
    persist("hand", { ms: performance.now() - start, steps: result.steps });
    await collect();
  };
  const cashMenu = async () => {
    await page.getByTestId("hand-result-cash-out").click();
    await page
      .getByRole("dialog", { name: "Cash out result" })
      .getByRole("button", { name: "ゲーム選択", exact: true })
      .click();
    await expect(page.getByTestId("menu-ring")).toBeVisible();
  };
  const cash = async (variant: string) => {
    await timed(`cash-${variant}`, async () => {
      await page.getByTestId("menu-ring").click();
      await selectGameVariantFromSelector(page, variant);
      await ready(variant);
    });
    await hand();
  };
  const pause = async () => {
    await page.getByTestId("hand-result-next-hand").click();
    await expect(page.getByTestId("hand-result-overlay")).toBeHidden();
    await page.getByLabel("対局メニュー", { exact: true }).click();
    await page.getByRole("button", { name: "大会を中断", exact: true }).click();
    await expect(page.getByTestId("menu-ring")).toBeVisible();
  };
  const session = await openAuthenticatedGame(
    page,
    `${APP_URL}?variant=badugi&mode=cash`,
  );
  const expectedRelease = process.env.MGX_PERF_EXPECTED_RELEASE;
  if (expectedRelease) {
    const response = await page.request.get(
      `${APP_URL.replace(/\/$/, "")}/release.json`,
    );
    expect((await response.json()).commit).toBe(expectedRelease);
  }
  try {
    await waitForE2EDriver(page);
    leg = "cold-badugi-cash";
    await hand();
    if (process.env.MGX_PERF_HISTORY_FILL === "1") {
      persist(
        "history-fixture",
        await page.evaluate(() => {
          const key = "badugi.history.hands";
          const originals = JSON.parse(localStorage.getItem(key) ?? "[]");
          if (!originals.length)
            throw new Error("No real completed history to seed");
          const records = [...originals];
          let added = 0;
          for (let i = 0; i < 100; i++) {
            const copy = JSON.parse(
              JSON.stringify(originals[i % originals.length]),
            );
            copy.handId = `performance-history-${i}`;
            records.push(copy);
            try {
              localStorage.setItem(key, JSON.stringify(records));
              added++;
            } catch (error) {
              records.pop();
              if (error.name !== "QuotaExceededError") throw error;
              break;
            }
          }
          return { added, bytes: (localStorage.getItem(key) ?? "").length * 2 };
        }),
      );
    }

    for (cycle = 0; cycle < CYCLES; cycle++) {
      await cashMenu(page);
      leg = "badeucey-cash";
      await cash(BADEUCEY);
      await cashMenu(page);
      leg = "badugi-after-badeucey";
      await cash("badugi");
      leg = "badeucey-mtt";
      await timed("start-badeucey-mtt", async () => {
        await page.evaluate(
          (variant) =>
            window.__BADUGI_E2E__.startTournamentMTT({
              id: "mobile-perf",
              name: "Mobile performance",
              practiceOnly: true,
              tables: 2,
              seatsPerTable: 6,
              totalPlayers: 12,
              startingStack: 2000,
              gameVariant: variant,
              gameRotation: [variant],
              rotationPolicy: "fixed",
              levels: [
                {
                  levelIndex: 1,
                  smallBlind: 5,
                  bigBlind: 10,
                  ante: 0,
                  handsThisLevel: 999,
                },
              ],
              payouts: [{ place: 1, percent: 100 }],
            }),
          BADEUCEY,
        );
        await ready(BADEUCEY);
      });
      await hand();
      await pause();
      leg = "badugi-after-paused-mtt";
      await cash("badugi");
      await cashMenu(page);
      leg = "resumed-badeucey-mtt";
      await timed("resume-badeucey-mtt", async () => {
        await page.getByTestId("menu-tournament").click();
        await page.getByTestId("tournament-resume").click();
        await page
          .getByRole("button", { name: /次のハンド|Next Hand/i })
          .click();
        await ready(BADEUCEY);
      });
      await hand();
      await pause();
      // Finish this isolated practice event via the real retirement control.
      await page.getByTestId("menu-tournament").click();
      await page.getByTestId("tournament-retire").click();
      await page.getByRole("button", { name: "戻る", exact: true }).click();
      leg = "cycle-boundary";
      await cash("badugi");
    }
    leg = "final-before-reload";
    await collect();
    const retained = await page.evaluate(() => {
      const logs = window.__BADUGI_E2E__?.drainLogs?.() ?? [];
      return {
        entries: logs.length,
        characters: logs.reduce(
          (sum: string | number, line: string) => Number(sum) + line.length,
          0,
        ),
      };
    });
    persist("diagnostic-buffer", retained);
    if (process.env.MGX_PERF_EXPECT_BOUNDED === "1") {
      expect(retained.entries).toBeLessThanOrEqual(256);
      expect(retained.characters).toBeLessThanOrEqual(256 * 1024);
    }
    await page.reload();
    await enterTitleIfPresent(page);
    leg = "after-reload";
    await cash("badugi");
    fs.writeFileSync(
      path.join(folder, "run.json"),
      JSON.stringify(
        {
          run: RUN,
          project: info.project.name,
          browserName,
          cycles: CYCLES,
          cpuRate: Number(process.env.MGX_PERF_CPU_RATE ?? 1),
          url: APP_URL,
          expectedRelease,
          rows,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await deleteAuthenticatedSession(page, session);
  }
});
