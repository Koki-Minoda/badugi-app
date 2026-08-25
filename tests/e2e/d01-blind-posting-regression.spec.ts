import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/browser-gameplay");
const SUMMARY_PATH = path.join(REPORT_DIR, "d01-blind-posting-regression-summary.json");

function writeSummary(payload: unknown) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

test("D01 blind posting, position badge, and displayed bet stay aligned", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=D01&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });

  const row = await page.evaluate(() => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label: "d01-blind-posting" }));
  const blind = row?.blindPosting;
  const summary = {
    status: "PENDING",
    variantId: row?.variantId,
    phase: row?.phase,
    handId: row?.handId,
    blindPosting: blind,
    reportPath: SUMMARY_PATH,
  };

  const expectedPosts = blind?.expectedBlindPosts ?? [];
  for (const post of expectedPosts) {
    const seatKey = String(post.seat);
    const displayed = blind?.displayedBetBySeat?.[seatKey];
    const invested = blind?.actualInvestedBySeat?.[seatKey];
    expect(invested, JSON.stringify({ ...summary, post }, null, 2)).toBeGreaterThanOrEqual(post.amount);
    expect(displayed, JSON.stringify({ ...summary, post }, null, 2)).toBe(post.amount);
  }

  if (typeof blind?.bbSeat === "number") {
    const bbPos = await page.getByTestId(`seat-${blind.bbSeat}-pos`).textContent();
    const bbBet = await page.getByTestId(`seat-${blind.bbSeat}-bet-amount`).textContent();
    expect(bbPos, JSON.stringify(summary, null, 2)).toContain("BB");
    expect(Number(bbBet), JSON.stringify(summary, null, 2)).toBe(blind.bigBlind);
    expect(blind.toCallBySeat?.[String(blind.bbSeat)], JSON.stringify(summary, null, 2)).toBe(0);
  }

  if (typeof blind?.sbSeat === "number") {
    const sbPos = await page.getByTestId(`seat-${blind.sbSeat}-pos`).textContent();
    expect(sbPos, JSON.stringify(summary, null, 2)).toContain("SB");
  }

  summary.status = "PASS";
  writeSummary(summary);
});
