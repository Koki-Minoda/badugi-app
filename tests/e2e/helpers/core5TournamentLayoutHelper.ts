import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import {
  APP_URL,
  openAuthenticatedGame,
} from "../authHelper";
import {
  CORE5_VARIANTS,
  ensureDirFor,
  saveScreenshot,
  statusFor,
  visibleBox,
  type AuditIssue,
} from "./core5LayoutAuditHelper";

export const TOURNAMENT_VIEWPORTS = [
  { name: "portrait-390x844", width: 390, height: 844, orientation: "portrait" },
  { name: "portrait-430x932", width: 430, height: 932, orientation: "portrait" },
  { name: "compact-landscape-720x280", width: 720, height: 280, orientation: "landscape" },
  { name: "landscape-844x390", width: 844, height: 390, orientation: "landscape" },
  { name: "pixel9-chrome-869x303", width: 869, height: 303, orientation: "landscape" },
  { name: "short-wide-932x280", width: 932, height: 280, orientation: "landscape" },
  { name: "landscape-932x430", width: 932, height: 430, orientation: "landscape" },
  { name: "foldable-landscape-1180x540", width: 1180, height: 540, orientation: "landscape" },
] as const;

export type TournamentViewport = (typeof TOURNAMENT_VIEWPORTS)[number];
export type Core5Variant = (typeof CORE5_VARIANTS)[number];

export type TournamentViewportLike = {
  name: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
};

type LayoutBox = NonNullable<Awaited<ReturnType<typeof visibleBox>>>;

function overlapRatio(a: LayoutBox | null, b: LayoutBox | null) {
  if (!a || !b) return 0;
  const x = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const y = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const overlap = x * y;
  const smallerArea = Math.max(
    1,
    Math.min(a.width * a.height, b.width * b.height),
  );
  return overlap / smallerArea;
}

function recordUnexpectedOverlap({
  issues,
  left,
  right,
  leftBox,
  rightBox,
  threshold = 0.08,
}: {
  issues: AuditIssue[];
  left: string;
  right: string;
  leftBox: LayoutBox | null;
  rightBox: LayoutBox | null;
  threshold?: number;
}) {
  const ratio = overlapRatio(leftBox, rightBox);
  if (ratio <= threshold) return;
  issues.push({
    priority: "P0",
    issue: "LAYOUT_ELEMENT_OVERLAP",
    message: `${left} overlaps ${right}`,
    value: { ratio, leftBox, rightBox },
  });
}

export async function openMobileTournamentContext(
  browser: Browser,
  viewport: TournamentViewport,
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      viewport.orientation === "landscape"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  });
  return { context, page: await context.newPage() };
}

export async function closeContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

export async function openCore5Tournament(page: Page, variant: Core5Variant) {
  if (variant.requiresPreview) {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.previewVariants", "true");
    });
  }
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.variant}`);
  await page.waitForFunction(
    () => typeof window.__BADUGI_E2E__?.startTournamentMTT === "function",
    undefined,
    { timeout: 20000 },
  );
  await page.evaluate((variantId) => {
    window.__BADUGI_E2E__.startTournamentMTT({
      id: `core5-mobile-tournament-${String(variantId).toLowerCase()}`,
      name: "Core 5 Mobile Tournament Layout",
      tables: 1,
      seatsPerTable: 6,
      startingStack: 5000,
      gameVariant: variantId,
      gameRotation: [variantId],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
    });
  }, variant.variant);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 20000 });
  await page.getByTestId("tournament-hud").waitFor({ state: "visible", timeout: 20000 });
}

function classifyMetricFailures({
  viewport,
  tableBox,
  hudBox,
  potBox,
  heroBox,
  decisionBox,
  issues,
}: {
  viewport: TournamentViewportLike;
  tableBox: Awaited<ReturnType<typeof visibleBox>>;
  hudBox: Awaited<ReturnType<typeof visibleBox>>;
  potBox: Awaited<ReturnType<typeof visibleBox>>;
  heroBox: Awaited<ReturnType<typeof visibleBox>>;
  decisionBox: Awaited<ReturnType<typeof visibleBox>>;
  issues: AuditIssue[];
}) {
  if (!tableBox) {
    issues.push({ priority: "P0", issue: "TABLE_COLLAPSED", message: "table surface missing" });
  } else if (viewport.orientation === "portrait" && tableBox.height < viewport.height * 0.42) {
    issues.push({ priority: "P0", issue: "TABLE_COLLAPSED", value: tableBox });
  } else if (viewport.orientation === "landscape" && tableBox.width < viewport.width * 0.58) {
    issues.push({ priority: "P0", issue: "LANDSCAPE_DENSITY_FAILURE", value: tableBox });
  }

  if (!hudBox) {
    issues.push({ priority: "P0", issue: "HUD_TOO_TALL", message: "HUD missing" });
  } else if (viewport.orientation === "portrait" && hudBox.height > viewport.height * 0.22) {
    issues.push({ priority: "P1", issue: "HUD_TOO_TALL", value: hudBox });
  } else if (viewport.orientation === "landscape" && hudBox.width > viewport.width * 0.32) {
    issues.push({ priority: "P1", issue: "HUD_TOO_TALL", value: hudBox });
  }

  if (potBox && tableBox) {
    const insideTable =
      potBox.x >= tableBox.x - 1 &&
      potBox.y >= tableBox.y - 1 &&
      potBox.x + potBox.width <= tableBox.x + tableBox.width + 1 &&
      potBox.y + potBox.height <= tableBox.y + tableBox.height + 1;
    if (!insideTable) {
      issues.push({ priority: "P0", issue: "POT_OVERLAP", message: "pot outside table surface", value: potBox });
    }
  }

  if (heroBox && viewport.orientation === "landscape" && heroBox.y + heroBox.height > viewport.height - 4) {
    issues.push({ priority: "P0", issue: "HERO_HAND_CLIPPED", value: heroBox });
  }

  if (decisionBox && decisionBox.y + decisionBox.height > viewport.height + 2) {
    issues.push({ priority: "P0", issue: "CONTROLS_CLIPPED", value: decisionBox });
  }
}

function centerOf(box: NonNullable<Awaited<ReturnType<typeof visibleBox>>>) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function validateLandscapeSeatGeometry({
  viewport,
  tableBox,
  seatBoxes,
  issues,
}: {
  viewport: TournamentViewportLike;
  tableBox: Awaited<ReturnType<typeof visibleBox>>;
  seatBoxes: Awaited<ReturnType<typeof visibleBox>>[];
  issues: AuditIssue[];
}) {
  if (viewport.orientation !== "landscape" || !tableBox || seatBoxes.some((box) => !box)) return;
  const boxes = seatBoxes as NonNullable<Awaited<ReturnType<typeof visibleBox>>>[];
  const centers = boxes.map(centerOf);
  const tableCenter = centerOf(tableBox);
  const normalized = centers.map((center) => ({
    x: (center.x - tableBox.x) / tableBox.width,
    y: (center.y - tableBox.y) / tableBox.height,
  }));

  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const insideTable =
      box.x >= tableBox.x - 1 &&
      box.y >= tableBox.y - 1 &&
      box.x + box.width <= tableBox.x + tableBox.width + 1 &&
      box.y + box.height <= tableBox.y + tableBox.height + 1;
    if (!insideTable) {
      issues.push({ priority: "P0", issue: "SEAT_OUTSIDE_TABLE", testId: `seat-${index}`, value: box });
    }
    for (let other = index + 1; other < boxes.length; other += 1) {
      const x = Math.max(
        0,
        Math.min(box.x + box.width, boxes[other].x + boxes[other].width) - Math.max(box.x, boxes[other].x),
      );
      const y = Math.max(
        0,
        Math.min(box.y + box.height, boxes[other].y + boxes[other].height) - Math.max(box.y, boxes[other].y),
      );
      if (x * y > 1) {
        issues.push({
          priority: "P0",
          issue: "SEAT_OVERLAP",
          message: `seat-${index} overlaps seat-${other}`,
          value: { overlapArea: x * y },
        });
      }
    }
  }

  const topOrderValid = centers[2].x < centers[3].x && centers[3].x < centers[4].x;
  const bottomOrderValid = centers[1].x < centers[0].x && centers[0].x < centers[5].x;
  const verticalArcValid =
    [2, 3, 4].every((index) => centers[index].y < tableCenter.y) &&
    [0, 1, 5].every((index) => centers[index].y > tableCenter.y);
  if (!topOrderValid || !bottomOrderValid || !verticalArcValid) {
    issues.push({ priority: "P0", issue: "SEAT_RING_ORDER_INVALID", value: centers });
  }

  const relativeArcValid =
    [2, 3, 4].every((index) => normalized[index].y < 0.4) &&
    [0, 1, 5].every((index) => normalized[index].y > 0.6) &&
    normalized[0].x > 0.35 && normalized[0].x < 0.65 &&
    [1, 2].every((index) => normalized[index].x < 0.3) &&
    [4, 5].every((index) => normalized[index].x > 0.7);
  if (!relativeArcValid) {
    issues.push({
      priority: "P0",
      issue: "SEAT_RING_RELATIVE_POSITION_INVALID",
      message: "seat centers left their viewport-relative table bands",
      value: normalized,
    });
  }

  const pairToleranceX = tableBox.width * 0.08;
  const pairToleranceY = tableBox.height * 0.08;
  for (const [left, right] of [[1, 5], [2, 4]] as const) {
    const mirroredCenterX = centers[left].x + centers[right].x;
    if (
      Math.abs(mirroredCenterX - tableCenter.x * 2) > pairToleranceX ||
      Math.abs(centers[left].y - centers[right].y) > pairToleranceY
    ) {
      issues.push({
        priority: "P1",
        issue: "SEAT_RING_ASYMMETRIC",
        message: `seat-${left}/seat-${right}`,
        value: { left: centers[left], right: centers[right], tableCenter },
      });
    }
  }
}

export async function evaluateTournamentMobileLayout(
  page: Page,
  variant: Core5Variant,
  viewport: TournamentViewportLike,
) {
  const issues: AuditIssue[] = [];
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) {
    issues.push({ priority: "P0", issue: "SAFE_AREA_COLLISION", value: overflow });
  }

  const required = [
    ["tournament-hud", "tournament HUD"],
    ["decision-panel", "hero controls"],
    ["game-table-surface", "table"],
    ["table-total-pot", "pot"],
    ["table-phase-badge", "phase"],
    ["seat-0", "hero seat"],
    [variant.heroCardTestId, "hero cards"],
  ] as const;
  for (const [testId, label] of required) {
    const box = await visibleBox(page, testId);
    if (!box) {
      issues.push({ priority: "P0", issue: `${label} not visible`, testId });
      continue;
    }
    if (box.x < -1 || box.x + box.width > viewport.width + 2) {
      issues.push({ priority: "P0", issue: `${label} horizontally clipped`, testId, value: box });
    }
    if (box.y < -1 || box.y + box.height > viewport.height + 2) {
      issues.push({ priority: "P0", issue: `${label} vertically clipped`, testId, value: box });
    }
  }

  const actionButtons = page.locator(
    "[data-testid='action-check'],[data-testid='action-call'],[data-testid='action-raise'],[data-testid='action-fold'],[data-testid='action-draw-selected']",
  );
  const actionCount = await actionButtons.count();
  let visibleActionButtons = 0;
  let minActionButtonHeight = Number.POSITIVE_INFINITY;
  const actionBoxes: Array<{ testId: string; box: LayoutBox }> = [];
  const visualViewport = await page.evaluate(() => ({
    x: window.visualViewport?.pageLeft ?? window.scrollX,
    y: window.visualViewport?.pageTop ?? window.scrollY,
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }));
  for (let index = 0; index < actionCount; index += 1) {
    const button = actionButtons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    visibleActionButtons += 1;
    const box = await button.boundingBox();
    const testId = (await button.getAttribute("data-testid")) ?? `action-${index}`;
    if (box) {
      minActionButtonHeight = Math.min(minActionButtonHeight, box.height);
      actionBoxes.push({ testId, box });
      const withinVisualViewport =
        box.x >= visualViewport.x - 1 &&
        box.y >= visualViewport.y - 1 &&
        box.x + box.width <= visualViewport.x + visualViewport.width + 1 &&
        box.y + box.height <= visualViewport.y + visualViewport.height + 1;
      if (!withinVisualViewport) {
        issues.push({
          priority: "P0",
          issue: "ACTION_OUTSIDE_VISUAL_VIEWPORT",
          testId,
          value: { box, visualViewport },
        });
      }
    }
    if (await button.isEnabled().catch(() => false)) {
      await button.click({ trial: true, timeout: 2_000 }).catch((error) => {
        issues.push({
          priority: "P0",
          issue: "ACTION_NOT_CLICKABLE",
          testId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
  if (visibleActionButtons > 0 && minActionButtonHeight < 40) {
    issues.push({ priority: "P1", issue: "action button below target size", value: minActionButtonHeight });
  }

  const foldBox = await visibleBox(page, "action-fold");
  if (foldBox) {
    if (foldBox.x < 0 || foldBox.x + foldBox.width > viewport.width || foldBox.y + foldBox.height > viewport.height) {
      issues.push({ priority: "P0", issue: "CONTROLS_CLIPPED", testId: "action-fold", value: foldBox });
    }
  }

  const tableBox = await visibleBox(page, "game-table-surface");
  const hudBox = await visibleBox(page, "tournament-hud");
  const potBox = await visibleBox(page, "table-total-pot");
  const heroBox = await visibleBox(page, "seat-0");
  const decisionBox = await visibleBox(page, "decision-panel");
  const phaseBox = await visibleBox(page, "table-phase-badge");
  const heroCardBox = await visibleBox(page, variant.heroCardTestId);
  const seatBoxes = await Promise.all(
    Array.from({ length: 6 }, (_, index) => visibleBox(page, `seat-${index}`)),
  );
  classifyMetricFailures({ viewport, tableBox, hudBox, potBox, heroBox, decisionBox, issues });
  validateLandscapeSeatGeometry({ viewport, tableBox, seatBoxes, issues });

  const cardLocators = page.locator("[data-testid^='player-'][data-testid*='-card-']");
  const cardBoxes: Array<{ testId: string; ownerSeat: number | null; box: LayoutBox }> = [];
  for (let index = 0; index < (await cardLocators.count()); index += 1) {
    const card = cardLocators.nth(index);
    if (!(await card.isVisible().catch(() => false))) continue;
    const box = await card.boundingBox();
    if (!box) continue;
    const testId = (await card.getAttribute("data-testid")) ?? `card-${index}`;
    const ownerMatch = /^player-(\d+)-card-/.exec(testId);
    cardBoxes.push({
      testId,
      ownerSeat: ownerMatch ? Number(ownerMatch[1]) : null,
      box,
    });
  }

  seatBoxes.forEach((seatBox, seatIndex) => {
    recordUnexpectedOverlap({
      issues,
      left: `seat-${seatIndex}`,
      right: "pot",
      leftBox: seatBox,
      rightBox: potBox,
    });
    recordUnexpectedOverlap({
      issues,
      left: `seat-${seatIndex}`,
      right: "phase",
      leftBox: seatBox,
      rightBox: phaseBox,
    });
    recordUnexpectedOverlap({
      issues,
      left: `seat-${seatIndex}`,
      right: "HUD",
      leftBox: seatBox,
      rightBox: hudBox,
      threshold: 0.01,
    });
    for (const action of actionBoxes) {
      recordUnexpectedOverlap({
        issues,
        left: `seat-${seatIndex}`,
        right: action.testId,
        leftBox: seatBox,
        rightBox: action.box,
        threshold: 0.01,
      });
    }
  });

  for (const card of cardBoxes) {
    recordUnexpectedOverlap({
      issues,
      left: card.testId,
      right: "pot",
      leftBox: card.box,
      rightBox: potBox,
    });
    recordUnexpectedOverlap({
      issues,
      left: card.testId,
      right: "phase",
      leftBox: card.box,
      rightBox: phaseBox,
    });
    seatBoxes.forEach((seatBox, seatIndex) => {
      if (card.ownerSeat === seatIndex) return;
      recordUnexpectedOverlap({
        issues,
        left: card.testId,
        right: `foreign-seat-${seatIndex}`,
        leftBox: card.box,
        rightBox: seatBox,
        threshold: 0.12,
      });
    });
  }

  for (let leftIndex = 0; leftIndex < cardBoxes.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < cardBoxes.length;
      rightIndex += 1
    ) {
      const left = cardBoxes[leftIndex];
      const right = cardBoxes[rightIndex];
      if (left.ownerSeat === right.ownerSeat) continue;
      recordUnexpectedOverlap({
        issues,
        left: left.testId,
        right: right.testId,
        leftBox: left.box,
        rightBox: right.box,
        threshold: 0.12,
      });
    }
  }

  for (const action of actionBoxes) {
    for (const [name, box] of [
      ["pot", potBox],
      ["phase", phaseBox],
      ["HUD", hudBox],
    ] as const) {
      recordUnexpectedOverlap({
        issues,
        left: action.testId,
        right: name,
        leftBox: action.box,
        rightBox: box,
        threshold: 0.01,
      });
    }
  }

  return {
    status: statusFor(issues),
    issues,
    metrics: {
      overflow,
      interaction: {
        visibleActionButtons,
        minActionButtonHeight: Number.isFinite(minActionButtonHeight) ? minActionButtonHeight : null,
      },
      visualViewport,
      boxes: {
        tableBox,
        hudBox,
        potBox,
        phaseBox,
        heroBox,
        heroCardBox,
        decisionBox,
        foldBox,
        seatBoxes,
        cardBoxes,
        actionBoxes,
      },
    },
  };
}

export function writeTournamentAuditReport(reportPath: string, rows: unknown[]) {
  ensureDirFor(reportPath);
  const statuses = rows.map((row: any) => row.status);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: statuses.includes("FAIL") ? "FAIL" : statuses.includes("WARN") ? "WARN" : "PASS",
        rows,
      },
      null,
      2,
    )}\n`,
  );
}

export async function saveTournamentScreenshot({
  page,
  prefix,
  variant,
  viewport,
}: {
  page: Page;
  prefix: string;
  variant: Core5Variant;
  viewport: TournamentViewport;
}) {
  return saveScreenshot(
    page,
    path.resolve(
      "reports/screenshots",
      `${prefix}-${variant.variant.toLowerCase()}-${viewport.name}.png`,
    ),
  );
}
