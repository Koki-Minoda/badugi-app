import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame, openAuthenticatedMenu } from "./authHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-variant-active-status.json");

const CORE5 = [
  {
    game: "Badugi",
    variantId: "badugi",
    selectorKey: "badugi",
    label: /Badugi/i,
    expectedAvailability: "preview_only",
    launchableByDefault: false,
    requiresPreview: true,
  },
  {
    game: "2-7 Triple Draw",
    variantId: "D01",
    selectorKey: "deuce_to_seven_triple_draw",
    label: /2-7 Triple Draw/i,
    expectedAvailability: "alpha_playable",
    launchableByDefault: true,
    requiresPreview: false,
  },
  {
    game: "A-5 Triple Draw",
    variantId: "D02",
    selectorKey: "ace_to_five_triple_draw",
    label: /A-5 Triple Draw/i,
    expectedAvailability: "alpha_playable",
    launchableByDefault: true,
    requiresPreview: false,
  },
  {
    game: "2-7 Single Draw",
    variantId: "S01",
    selectorKey: "deuce_to_seven_single_draw",
    label: /2-7 Single Draw/i,
    expectedAvailability: "alpha_playable",
    launchableByDefault: true,
    requiresPreview: false,
    category: /Single Draw|シングルドロー/i,
  },
  {
    game: "A-5 Single Draw",
    variantId: "S02",
    selectorKey: "ace_to_five_single_draw",
    label: /A-5 Single Draw/i,
    expectedAvailability: "alpha_playable",
    launchableByDefault: true,
    requiresPreview: false,
    category: /Single Draw|シングルドロー/i,
  },
] as const;

async function openSelector(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.showBuildInfo", "true");
  });
  await openAuthenticatedMenu(page, `${APP_URL}?buildInfo=1`);
  await page.getByTestId("menu-ring").click();
  await expect(page.getByText(/Select Your Variant|ゲームを選択/i)).toBeVisible({ timeout: 20000 });
}

test.describe("Core 5 variant active status", () => {
  test.describe.configure({ timeout: 120000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: rows.every((row) => row.status === "PASS") ? "PASS" : "FAIL",
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  test("build info is exposed for deploy snapshot verification", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.showBuildInfo", "true");
    });
    await openAuthenticatedMenu(page, `${APP_URL}?buildInfo=1`);
    const buildInfo = await page.evaluate(() => (window as any).__MGX_BUILD_INFO__ ?? null);

    expect(buildInfo?.commit).toBeTruthy();
  });

  test("Core 5 availability labels and launch buttons match alpha scope", async ({ page }) => {
    await openSelector(page);

    for (const entry of CORE5) {
      if ("category" in entry && entry.category) {
        await page.getByRole("button", { name: entry.category }).first().click();
      }
      const card = page.getByTestId(`game-selector-card-${entry.selectorKey}`);
      const button = page.getByTestId(`game-selector-play-${entry.selectorKey}`);
      await expect(card).toContainText(entry.label);
      if (entry.launchableByDefault) {
        await expect(button).toBeEnabled();
        await expect(card).toContainText(/Alpha/i);
      } else {
        await expect(button).toBeDisabled();
        await expect(card).toContainText(/Preview|検証中/i);
      }
      rows.push({
        game: entry.game,
        variantId: entry.variantId,
        uiLabel: entry.game,
        availability: entry.expectedAvailability,
        launchable: entry.launchableByDefault,
        status: "PASS",
      });
    }
  });

  for (const entry of CORE5.filter((item) => item.launchableByDefault)) {
    test(`${entry.game} launches from direct alpha route`, async ({ page }) => {
      await openAuthenticatedGame(page, `${APP_URL}?variant=${entry.variantId}`);
      await expect(page.getByText(entry.label).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
    });
  }
});
