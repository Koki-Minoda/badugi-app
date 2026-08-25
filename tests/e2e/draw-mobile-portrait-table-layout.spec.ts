import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  invokeE2E,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve(
  "reports/ui/draw-mobile-portrait-table-layout.json",
);
const SCREENSHOT_DIR = path.resolve(
  "reports/screenshots/draw-mobile-portrait-table-layout",
);

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

const VARIANTS = [
  {
    label: "Badugi",
    variantId: "badugi",
    layoutGroup: "badugi",
    handCardCount: 4,
  },
  {
    label: "A-5TD",
    variantId: "D02",
    layoutGroup: "draw-lowball-5card",
    handCardCount: 5,
  },
  {
    label: "2-7TD",
    variantId: "D01",
    layoutGroup: "draw-lowball-5card",
    handCardCount: 5,
  },
] as const;

function ensureDirs() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openVariant(
  page: Page,
  variantId: string,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(
    page,
    `${APP_URL}?variant=${variantId}&mgxQa=mobile`,
  );
  await waitForE2EDriver(page);
  await expect(page.getByTestId("game-table-surface")).toBeVisible({
    timeout: 20000,
  });
}

async function visibleBox(page: Page, testId: string) {
  const locator = page.getByTestId(testId).first();
  if (!(await locator.isVisible().catch(() => false))) return null;
  return locator.boundingBox();
}

function intersectionRatio(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const x = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const y = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return (
    (x * y) / Math.max(1, Math.min(a.width * a.height, b.width * b.height))
  );
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
    bodyOverflow: document.body.scrollWidth - window.innerWidth,
  }));
  expect(
    overflow.documentOverflow,
    `document overflow ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(1);
  expect(
    overflow.bodyOverflow,
    `body overflow ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(1);
}

async function advanceToHeroControls(page: Page) {
  for (let step = 0; step < 12; step += 1) {
    const callOrCheck = (await page
      .getByTestId("action-call")
      .isVisible()
      .catch(() => false))
      ? "action-call"
      : "action-check";
    const allVisible = await Promise.all(
      ["action-fold", callOrCheck, "action-raise"].map((testId) =>
        page
          .getByTestId(testId)
          .isVisible()
          .catch(() => false),
      ),
    );
    if (allVisible.every(Boolean))
      return ["action-fold", callOrCheck, "action-raise"] as const;

    const progress = await getProgressState(page);
    if (
      progress?.phase !== "BET" ||
      typeof progress.actor !== "number" ||
      progress.actor === 0
    ) {
      await page.waitForTimeout(150);
      continue;
    }
    const actor = progress.actor;
    const players = progress.players ?? [];
    const actorBet = Number(
      players[actor]?.betThisRound ?? players[actor]?.bet ?? 0,
    );
    const currentBet = Number(progress.currentBet ?? 0);
    await invokeE2E(page, "forceControllerAction", actor, {
      type: currentBet > actorBet ? "call" : "check",
      amount: currentBet,
      reason: "mobile-portrait-layout-advance",
    });
    await page.waitForTimeout(150);
  }
  throw new Error(
    "hero controls did not become visible for mobile portrait layout assertion",
  );
}

async function assertActionButtons(page: Page) {
  const viewport = page.viewportSize();
  const actionIds = await advanceToHeroControls(page);
  const boxes = [];
  for (const testId of actionIds) {
    const box = await visibleBox(page, testId);
    expect(box, `${testId} visible`).toBeTruthy();
    expect(box!.height, `${testId} target height`).toBeGreaterThanOrEqual(44);
    if (viewport) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    boxes.push(box!);
  }
  expect(boxes[0].x).toBeLessThan(boxes[1].x);
  expect(boxes[1].x).toBeLessThan(boxes[2].x);
}

async function assertCardsInsideSeats(page: Page, handCardCount: number) {
  for (const seat of [0, 1, 2, 3, 4, 5]) {
    const seatBox = await visibleBox(page, `seat-${seat}`);
    expect(seatBox, `seat ${seat} visible`).toBeTruthy();
    const rowBox = await visibleBox(page, `player-${seat}-card-row`);
    if (!rowBox) continue;
    expect(rowBox.x, `seat ${seat} card row left`).toBeGreaterThanOrEqual(
      seatBox!.x - 2,
    );
    expect(
      rowBox.x + rowBox.width,
      `seat ${seat} card row right`,
    ).toBeLessThanOrEqual(seatBox!.x + seatBox!.width + 2);
    for (let card = 0; card < handCardCount; card += 1) {
      await expect(
        page.getByTestId(`player-${seat}-card-${card}`).first(),
      ).toBeVisible();
    }
  }
}

async function assertSeatSeparation(page: Page) {
  const topSeats = [];
  for (const seat of [2, 3, 4]) {
    const box = await visibleBox(page, `seat-${seat}`);
    expect(box, `top seat ${seat} visible`).toBeTruthy();
    topSeats.push({ seat, box: box! });
  }
  for (let i = 0; i < topSeats.length; i += 1) {
    for (let j = i + 1; j < topSeats.length; j += 1) {
      const ratio = intersectionRatio(topSeats[i].box, topSeats[j].box);
      expect(
        ratio,
        `top seat overlap ${JSON.stringify({ a: topSeats[i], b: topSeats[j] })}`,
      ).toBeLessThanOrEqual(0.08);
    }
  }
}

async function assertFoldedBadgeDoesNotCoverSeat(page: Page) {
  await invokeE2E(page, "forceMarkSeatFoldedForTest", 3);
  await page.waitForTimeout(100);
  const seatBox = await visibleBox(page, "seat-3");
  const badgeBox = await visibleBox(page, "player-3-mucked");
  if (!seatBox || !badgeBox) return;
  expect(badgeBox.height, "folded badge should be compact").toBeLessThanOrEqual(
    24,
  );
  expect(badgeBox.x).toBeGreaterThanOrEqual(seatBox.x - 2);
  expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
    seatBox.x + seatBox.width + 2,
  );
}

async function assertRoundRailCompact(page: Page) {
  const strip = await visibleBox(page, "phase-compact-strip");
  const decision = await visibleBox(page, "decision-panel");
  const viewport = page.viewportSize();
  expect(strip, "phase compact strip visible").toBeTruthy();
  expect(decision, "decision panel visible").toBeTruthy();
  expect(strip!.height, "round rail height").toBeLessThanOrEqual(46);
  if (viewport) {
    expect(
      decision!.height / viewport.height,
      "action/round panel should stay compact",
    ).toBeLessThanOrEqual(0.24);
  }
}

test.describe("draw-family mobile portrait table layout", () => {
  test.describe.configure({ timeout: 240000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureDirs();
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
  });

  for (const variant of VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant.label} ${viewport.name} uses compact portrait table layout`, async ({
        page,
      }) => {
        ensureDirs();
        await openVariant(page, variant.variantId, viewport);
        await expect(
          page.locator(`[data-layout-group="${variant.layoutGroup}"]`),
        ).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await assertSeatSeparation(page);
        await assertCardsInsideSeats(page, variant.handCardCount);
        await assertRoundRailCompact(page);
        await assertActionButtons(page);
        await assertFoldedBadgeDoesNotCoverSeat(page);
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${variant.variantId}-${viewport.name}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        rows.push({
          variantId: variant.variantId,
          viewport: viewport.name,
          status: "PASS",
          screenshotPath,
        });
      });
    }
  }
});
