import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { CORE5_VARIANTS, ensureDirFor, saveScreenshot, statusFor, visibleBox, type AuditIssue } from "./core5LayoutAuditHelper";
import { waitForE2EDriver } from "./gameProgressHelper.js";

export const LIVE_URL = "https://mgx-poker.com/";
export const LIVE_API_URL = `${LIVE_URL.replace(/\/$/, "")}/api`;

const DEFAULT_PASSWORD = "MgxE2E!2026";

export const LIVE_LAYOUT_VIEWPORTS = [
  { name: "portrait-390x844", width: 390, height: 844, orientation: "portrait" },
  { name: "portrait-430x932", width: 430, height: 932, orientation: "portrait" },
  { name: "landscape-844x390", width: 844, height: 390, orientation: "landscape" },
] as const;

export type LiveLayoutViewport = (typeof LIVE_LAYOUT_VIEWPORTS)[number];
export type Core5Variant = (typeof CORE5_VARIANTS)[number];

export function uniqueLiveEmail(prefix = "mgx.live-e2e") {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}+${nonce}@mgx-e2e.com`;
}

export async function createLiveAuthenticatedSession(page: Page) {
  const email = uniqueLiveEmail();
  const signup = await page.request.post(`${LIVE_API_URL}/auth/signup`, {
    data: { email, password: DEFAULT_PASSWORD },
  });
  if (!signup.ok() && signup.status() !== 400) {
    throw new Error(`Live signup failed: ${signup.status()} ${await signup.text()}`);
  }

  const login = await page.request.post(`${LIVE_API_URL}/auth/login`, {
    data: { email, password: DEFAULT_PASSWORD },
  });
  if (!login.ok()) {
    throw new Error(`Live login failed: ${login.status()} ${await login.text()}`);
  }
  const loginPayload = await login.json();
  const token = loginPayload?.access_token;
  if (!token) throw new Error("Live login did not return access_token");
  const scheme = String(loginPayload?.token_type ?? "bearer").toLowerCase() === "bearer"
    ? "Bearer"
    : String(loginPayload?.token_type ?? "Bearer");

  const profile = await page.request.get(`${LIVE_API_URL}/auth/me`, {
    headers: { Authorization: `${scheme} ${token}` },
  });
  if (!profile.ok()) {
    throw new Error(`Live /auth/me failed: ${profile.status()} ${await profile.text()}`);
  }
  const userProfile = await profile.json();
  const authState = {
    accessToken: token,
    tokenType: scheme,
    user: {
      id: userProfile?.id ?? null,
      username: userProfile?.username ?? email,
      email: userProfile?.email ?? email,
    },
    isAuthenticated: true,
  };

  await page.addInitScript((state) => {
    window.localStorage.setItem("mgx_auth", JSON.stringify(state));
  }, authState);
}

export async function gotoLiveWithRetry(page: Page, url = LIVE_URL, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: Math.min(15000, timeout) });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError ?? new Error(`Failed to load live URL within ${timeout}ms`);
}

async function enterTitleIfPresent(page: Page) {
  const titleButton = page.getByTestId("title-enter-button").first();
  if (await titleButton.count()) {
    await titleButton.waitFor({ state: "visible", timeout: 15000 });
    await titleButton.click();
    return;
  }

  const legacyStartButton = page.getByRole("button", { name: /start|press enter/i }).first();
  if (await legacyStartButton.count()) {
    await legacyStartButton.click().catch(() => {});
  }
}

export async function openLiveMenu(page: Page, url = LIVE_URL) {
  await createLiveAuthenticatedSession(page);
  await gotoLiveWithRetry(page, url);
  await enterTitleIfPresent(page);
  await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 30000 });
}

export async function openLiveGame(page: Page, variant: Core5Variant | { variant: string }) {
  await openLiveMenu(page, `${LIVE_URL}?variant=${variant.variant}&buildInfo=1`);
  await page.getByTestId("menu-ring").click();
  const canonical = {
    badugi: "badugi",
    D01: "deuce_to_seven_triple_draw",
    D02: "ace_to_five_triple_draw",
    S01: "deuce_to_seven_single_draw",
    S02: "ace_to_five_single_draw",
  }[variant.variant] ?? variant.variant;
  const playButton = page.getByTestId(`game-selector-play-${canonical}`).first();
  if (await playButton.count()) {
    await playButton.click();
  } else {
    const category = /triple/i.test(canonical)
      ? /Triple Draw|トリプルドロー/i
      : /single/i.test(canonical)
        ? /Single Draw|シングルドロー/i
        : /Badugi/i;
    await page.getByRole("button", { name: category }).first().click();
    await page.getByTestId(`game-selector-play-${canonical}`).first().click();
  }
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

export async function openLiveMobileContext(browser: Browser, viewport: LiveLayoutViewport) {
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

export async function closeLiveContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

export async function openLiveTournament(page: Page, variant: Core5Variant) {
  await openLiveGame(page, variant);
  await page.waitForFunction(
    () => typeof window.__BADUGI_E2E__?.startTournamentMTT === "function",
    undefined,
    { timeout: 30000 },
  );
  await page.evaluate((variantId) => {
    window.__BADUGI_E2E__.startTournamentMTT({
      id: `live-core5-tournament-${String(variantId).toLowerCase()}`,
      name: "Live Core5 Tournament Evidence",
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
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("tournament-hud").waitFor({ state: "visible", timeout: 30000 });
}

export async function getLiveBuildInfo(page: Page) {
  await gotoLiveWithRetry(page, `${LIVE_URL}?buildInfo=1`);
  return page.evaluate(() => ({
    buildInfo: window.__MGX_BUILD_INFO__ ?? null,
    scripts: [...document.scripts].map((script) => script.getAttribute("src")).filter(Boolean),
    stylesheets: [...document.querySelectorAll("link[rel='stylesheet']")]
      .map((link) => link.getAttribute("href"))
      .filter(Boolean),
    buildBadgeText: document.querySelector("[data-testid='mgx-build-info']")?.textContent ?? null,
  }));
}

export async function evaluateLiveGameplayLayout(
  page: Page,
  variant: Core5Variant,
  viewport: LiveLayoutViewport,
  mode: "cash" | "tournament",
) {
  const issues: AuditIssue[] = [];
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 999);
  if (overflow > 2) issues.push({ priority: "P0", issue: "SAFE_AREA_COLLISION", value: overflow });

  const required = [
    ["decision-panel", "action controls"],
    ["game-table-surface", "table"],
    ["table-total-pot", "pot"],
    ["table-phase-badge", "phase"],
    ["seat-0", "hero seat"],
    [variant.heroCardTestId, "hero cards"],
  ] as const;
  if (mode === "tournament") required.push(["tournament-hud", "tournament HUD"] as any);

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

  const tableBox = await visibleBox(page, "game-table-surface");
  const hudBox = await visibleBox(page, "tournament-hud");
  const potBox = await visibleBox(page, "table-total-pot");
  const heroBox = await visibleBox(page, "seat-0");
  const decisionBox = await visibleBox(page, "decision-panel");
  const foldBox = await visibleBox(page, "action-fold");
  const heroCardBox = await visibleBox(page, variant.heroCardTestId);

  if (!tableBox || tableBox.height < viewport.height * (viewport.orientation === "portrait" ? 0.36 : 0.44)) {
    issues.push({ priority: "P0", issue: "TABLE_COLLAPSED", value: tableBox });
  }
  if (mode === "tournament" && hudBox) {
    if (viewport.orientation === "portrait" && hudBox.height > viewport.height * 0.28) {
      issues.push({ priority: "P1", issue: "HUD_TOO_TALL", value: hudBox });
    }
    if (viewport.orientation === "landscape" && hudBox.width > viewport.width * 0.38) {
      issues.push({ priority: "P1", issue: "HUD_TOO_TALL", value: hudBox });
    }
  }
  if (potBox && tableBox) {
    const inside =
      potBox.x >= tableBox.x - 1 &&
      potBox.y >= tableBox.y - 1 &&
      potBox.x + potBox.width <= tableBox.x + tableBox.width + 1 &&
      potBox.y + potBox.height <= tableBox.y + tableBox.height + 1;
    if (!inside) issues.push({ priority: "P0", issue: "POT_OVERLAP", message: "pot outside table surface", value: potBox });
  }
  if (decisionBox && decisionBox.y + decisionBox.height > viewport.height + 2) {
    issues.push({ priority: "P0", issue: "ACTION_CLIPPED", value: decisionBox });
  }
  if (foldBox && (foldBox.x < 0 || foldBox.x + foldBox.width > viewport.width || foldBox.y + foldBox.height > viewport.height)) {
    issues.push({ priority: "P0", issue: "ACTION_CLIPPED", testId: "action-fold", value: foldBox });
  }
  if (heroBox && heroBox.y + heroBox.height > viewport.height + 2) {
    issues.push({ priority: "P0", issue: "HERO_HAND_CLIPPED", value: heroBox });
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
  const heroActionExpected = await page
    .evaluate(() => {
      const api = window.__BADUGI_E2E__;
      const phaseState = api?.getPhaseState?.() ?? null;
      const state = api?.getStateSnapshot?.() ?? null;
      const snapshot = state?.controllerSnapshot ?? null;
      const turn =
        typeof phaseState?.turn === "number"
          ? phaseState.turn
          : typeof snapshot?.currentActor === "number"
            ? snapshot.currentActor
            : typeof snapshot?.turn === "number"
              ? snapshot.turn
              : typeof state?.turn === "number"
                ? state.turn
                : null;
      const phase = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase ?? null;
      return turn === 0 && String(phase ?? "").toUpperCase() === "BET";
    })
    .catch(() => false);
  if (heroActionExpected && visibleActionButtons === 0) {
    issues.push({ priority: "P0", issue: "ACTION_CLIPPED", message: "hero is canonical actor but no action buttons are visible" });
  }
  if (visibleActionButtons > 0 && minActionButtonHeight < 40) {
    issues.push({ priority: "P1", issue: "action button below target size", value: minActionButtonHeight });
  }

  return {
    status: statusFor(issues),
    issues,
    metrics: {
      overflow,
      heroActionExpected,
      visibleActionButtons,
      minActionButtonHeight: Number.isFinite(minActionButtonHeight) ? minActionButtonHeight : null,
      boxes: { tableBox, hudBox, potBox, heroBox, heroCardBox, decisionBox, foldBox },
    },
  };
}

export function writeLiveReport(reportPath: string, rows: unknown[], extra: Record<string, unknown> = {}) {
  ensureDirFor(reportPath);
  const statuses = rows.map((row: any) => row.status);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: statuses.includes("FAIL") ? "FAIL" : statuses.includes("WARN") ? "WARN" : "PASS",
        ...extra,
        rows,
      },
      null,
      2,
    )}\n`,
  );
}

export async function saveLiveScreenshot({
  page,
  prefix,
  variant,
  viewport,
  mode,
}: {
  page: Page;
  prefix: string;
  variant: Core5Variant;
  viewport: LiveLayoutViewport;
  mode: string;
}) {
  return saveScreenshot(
    page,
    path.resolve(
      "reports/screenshots",
      `${prefix}-${variant.variant.toLowerCase()}-${mode}-${viewport.name}.png`,
    ),
  );
}
