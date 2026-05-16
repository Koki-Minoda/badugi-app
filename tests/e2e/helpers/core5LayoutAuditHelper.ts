import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "../authHelper";
import {
  expectMobileActionsInViewport,
  playOneHandProgression,
  waitForE2EDriver,
} from "./gameProgressHelper.js";

export type AuditIssue = {
  priority: "P0" | "P1" | "P2" | "MONITOR";
  issue: string;
  testId?: string;
  value?: unknown;
  message?: string;
};

export const CORE5_VARIANTS = [
  {
    game: "Badugi",
    variant: "badugi",
    displayName: "Badugi",
    heroCardTestId: "player-0-card-3",
    requiresPreview: true,
    maxSteps: 120,
  },
  {
    game: "2-7 Triple Draw",
    variant: "D01",
    displayName: "2-7 Triple Draw",
    heroCardTestId: "player-0-card-4",
    requiresPreview: false,
    maxSteps: 110,
  },
  {
    game: "A-5 Triple Draw",
    variant: "D02",
    displayName: "A-5 Triple Draw",
    heroCardTestId: "player-0-card-4",
    requiresPreview: false,
    maxSteps: 110,
  },
  {
    game: "2-7 Single Draw",
    variant: "S01",
    displayName: "2-7 Single Draw",
    heroCardTestId: "player-0-card-4",
    requiresPreview: false,
    maxSteps: 90,
  },
  {
    game: "A-5 Single Draw",
    variant: "S02",
    displayName: "A-5 Single Draw",
    heroCardTestId: "player-0-card-4",
    requiresPreview: false,
    maxSteps: 90,
  },
] as const;

export function ensureDirFor(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeAuditReport(reportPath: string, rows: unknown[]) {
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

export function captureFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(text)) {
      return;
    }
    errors.push(text);
  });
  return errors;
}

export async function launchCore5Variant(
  page: Page,
  variant: (typeof CORE5_VARIANTS)[number],
  viewport: { width: number; height: number },
) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.variant}`);
  await waitForE2EDriver(page);
}

export async function visibleBox(page: Page, testId: string) {
  const locator = page.getByTestId(testId).first();
  if (!(await locator.isVisible().catch(() => false))) {
    return null;
  }
  return locator.boundingBox();
}

export function overlapRatio(
  a: Awaited<ReturnType<typeof visibleBox>>,
  b: Awaited<ReturnType<typeof visibleBox>>,
) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const overlap = x * y;
  const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return overlap / smaller;
}

export async function evaluateInitialLayout(
  page: Page,
  variant: (typeof CORE5_VARIANTS)[number],
) {
  const issues: AuditIssue[] = [];
  const viewport = page.viewportSize();
  const overflow = await page
    .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    .catch(() => 999);
  if (overflow > 2) {
    issues.push({ priority: "P0", issue: "horizontal overflow", value: overflow });
  }

  const required = [
    ["decision-panel", "action controls"],
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
    if (
      viewport &&
      (box.x < -1 ||
        box.y < -1 ||
        box.x + box.width > viewport.width + 2 ||
        box.y + box.height > viewport.height + 2)
    ) {
      issues.push({ priority: "P1", issue: `${label} clipped`, testId, value: box });
    }
  }

  const potBox = await visibleBox(page, "table-total-pot");
  const heroBox = await visibleBox(page, "seat-0");
  const decisionBox = await visibleBox(page, "decision-panel");
  const heroPotOverlap = overlapRatio(potBox, heroBox);
  const potControlsOverlap = overlapRatio(potBox, decisionBox);
  if (heroPotOverlap > 0.25) {
    issues.push({ priority: "P1", issue: "pot overlaps hero seat", value: heroPotOverlap });
  }
  if (potControlsOverlap > 0.05) {
    issues.push({ priority: "P0", issue: "pot overlaps action controls", value: potControlsOverlap });
  }

  return {
    issues,
    metrics: { overflow, heroPotOverlap, potControlsOverlap },
  };
}

export async function evaluateMobileInteraction(page: Page) {
  const issues: AuditIssue[] = [];
  await expectMobileActionsInViewport(page).catch((error) => {
    issues.push({ priority: "P0", issue: "mobile action button outside usable viewport", message: error.message });
  });

  const buttons = page.locator(
    "[data-testid='action-check'],[data-testid='action-call'],[data-testid='action-raise'],[data-testid='action-fold'],[data-testid='action-draw-selected']",
  );
  const count = await buttons.count();
  let visibleActionButtons = 0;
  let minActionButtonHeight = Number.POSITIVE_INFINITY;
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    visibleActionButtons += 1;
    const box = await button.boundingBox();
    if (box) minActionButtonHeight = Math.min(minActionButtonHeight, box.height);
  }
  if (visibleActionButtons === 0) {
    issues.push({ priority: "P0", issue: "no visible action buttons" });
  }
  if (Number.isFinite(minActionButtonHeight) && minActionButtonHeight < 40) {
    issues.push({ priority: "P1", issue: "action button below target size", value: minActionButtonHeight });
  }

  return {
    issues,
    metrics: {
      visibleActionButtons,
      minActionButtonHeight: Number.isFinite(minActionButtonHeight) ? minActionButtonHeight : null,
    },
  };
}

export async function evaluateResultFlow(
  page: Page,
  variant: (typeof CORE5_VARIANTS)[number],
) {
  const issues: AuditIssue[] = [];
  const result = await playOneHandProgression(page, {
    maxSteps: variant.maxSteps,
    policy: "safe",
    requireHeroButtonClick: true,
    requireDrawVisit: true,
  }).catch((error) => {
    issues.push({ priority: "P0", issue: "one-hand result flow did not complete", message: error.message });
    return null;
  });

  const resultOverlayVisible = await page
    .getByText("Hand Result")
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const resultPotVisible = await page
    .getByTestId("hand-result-pot")
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const nextHandVisible = await page.getByRole("button", { name: /next hand/i }).first().isVisible().catch(() => false);

  if (!resultOverlayVisible) {
    issues.push({ priority: "P0", issue: "result overlay not visible" });
  }
  if (!resultPotVisible) {
    issues.push({ priority: "P1", issue: "result pot not visible" });
  }
  if (!nextHandVisible) {
    issues.push({ priority: "P1", issue: "next hand button not visible" });
  }

  return {
    issues,
    metrics: result
      ? {
          steps: result.steps,
          visitedPhases: result.visitedPhases,
          visitedDrawRounds: result.visitedDrawRounds,
          heroButtonClicks: result.heroButtonClicks,
        }
      : {},
  };
}

export function statusFor(issues: AuditIssue[]) {
  if (issues.some((issue) => issue.priority === "P0")) return "FAIL";
  if (issues.some((issue) => issue.priority === "P1")) return "WARN";
  return "PASS";
}

export async function saveScreenshot(page: Page, screenshotPath: string) {
  ensureDirFor(screenshotPath);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}
