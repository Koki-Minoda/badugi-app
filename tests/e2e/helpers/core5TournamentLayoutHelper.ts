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
  { name: "landscape-844x390", width: 844, height: 390, orientation: "landscape" },
  { name: "landscape-932x430", width: 932, height: 430, orientation: "landscape" },
] as const;

export type TournamentViewport = (typeof TOURNAMENT_VIEWPORTS)[number];
export type Core5Variant = (typeof CORE5_VARIANTS)[number];

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
  viewport: TournamentViewport;
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

export async function evaluateTournamentMobileLayout(
  page: Page,
  variant: Core5Variant,
  viewport: TournamentViewport,
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
  for (let index = 0; index < actionCount; index += 1) {
    const button = actionButtons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    visibleActionButtons += 1;
    const box = await button.boundingBox();
    if (box) minActionButtonHeight = Math.min(minActionButtonHeight, box.height);
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
  classifyMetricFailures({ viewport, tableBox, hudBox, potBox, heroBox, decisionBox, issues });

  return {
    status: statusFor(issues),
    issues,
    metrics: {
      overflow,
      interaction: {
        visibleActionButtons,
        minActionButtonHeight: Number.isFinite(minActionButtonHeight) ? minActionButtonHeight : null,
      },
      boxes: { tableBox, hudBox, potBox, heroBox, decisionBox, foldBox },
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
