import { expect, test, type Page } from "@playwright/test";
import { APP_URL } from "./authHelper";
import {
  CORE5_VARIANTS,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";
import { evaluateTournamentMobileLayout } from "./helpers/core5TournamentLayoutHelper";

const TOURNAMENT_URL = `${APP_URL.replace(/\/$/, "")}/dev/tournament`;
const FRIEND_MATCH_URL = `${APP_URL.replace(/\/$/, "")}/dev/friend-match`;

function deviceViewports(projectName: string) {
  return projectName === "tournament-android-chromium"
    ? [
        { name: "pixel-7-portrait", width: 412, height: 915 },
        { name: "pixel-7-landscape", width: 915, height: 412 },
      ]
    : [
        { name: "iphone-13-portrait", width: 390, height: 844 },
        { name: "iphone-13-landscape", width: 844, height: 390 },
      ];
}

async function expectUsable(page: Page, testId: string) {
  const locator = page.getByTestId(testId).first();
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const result = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      disabled: element instanceof HTMLButtonElement ? element.disabled : false,
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  expect(result.disabled).toBe(false);
  expect(result.left).toBeGreaterThanOrEqual(-1);
  expect(result.right).toBeLessThanOrEqual(result.width + 1);
  expect(result.top).toBeGreaterThanOrEqual(-1);
  expect(result.bottom).toBeLessThanOrEqual(result.height + 1);
}

async function installDeviceSession(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? {
          id: 7002,
          username: "Device Hero",
          email: "device.hero@mgx-e2e.test",
        }
      : pathname.endsWith("/p2p/rooms")
        ? {
            data: {
              roomCode: "mobile-device-room",
              viewerId: "device-hero",
              phase: "waiting",
              players: [{ id: "device-hero", displayName: "Device Hero" }],
              variantId: "badugi",
              config: { startingStack: 2000, smallBlind: 10, bigBlind: 20, ante: 0 },
              maxPlayers: 2,
            },
          }
      : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.addInitScript(() => {
    class DeviceWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = DeviceWebSocket.CONNECTING;
      listeners: Record<string, Array<(event?: any) => void>> = {};

      constructor() {
        setTimeout(() => {
          this.readyState = DeviceWebSocket.OPEN;
          this.emit("open", {});
        }, 0);
      }

      addEventListener(type: string, handler: (event?: any) => void) {
        this.listeners[type] = [...(this.listeners[type] ?? []), handler];
      }

      emit(type: string, event: any) {
        for (const handler of this.listeners[type] ?? []) handler(event);
      }

      send() {}

      close() {
        this.readyState = DeviceWebSocket.CLOSED;
      }
    }
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: DeviceWebSocket,
    });
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "local-tournament-device-token",
        tokenType: "Bearer",
        user: {
          id: 7002,
          username: "Device Hero",
          email: "device.hero@mgx-e2e.test",
        },
        isAuthenticated: true,
      }),
    );
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
}

test("configured mobile browser keeps the tournament table and actions usable", async ({
  page,
}, testInfo) => {
  test.skip(
    ![
      "tournament-android-chromium",
      "tournament-iphone-webkit",
    ].includes(testInfo.project.name),
    "This smoke relies on the explicit mobile device projects.",
  );
  await installDeviceSession(page);
  await page.goto(TOURNAMENT_URL, { waitUntil: "load" });
  await page.getByTestId("tournament-start").click();
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.setupMobileTournamentHeroActionFixtureForTest ===
      "function",
    undefined,
    { timeout: 20_000 },
  );
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const blocking: Array<AuditIssue & { variantId: string }> = [];
  for (const variant of CORE5_VARIANTS) {
    await page.evaluate((variantId) =>
      window.__BADUGI_E2E__.setupMobileTournamentHeroActionFixtureForTest({
        variantId,
      }), variant.variant);
    await expect(page.getByTestId("decision-panel")).toBeVisible();
    await expect(page.getByTestId("seat-0-name")).toHaveText("Device Hero");
    await expect(page.getByTestId(variant.heroCardTestId)).toBeVisible();
    await expect(page.getByTestId(/^player-0-card-\d+$/)).toHaveCount(
      variant.initialCardCount,
    );

    const result = await evaluateTournamentMobileLayout(
      page,
      variant,
      {
        name: testInfo.project.name,
        width: viewport!.width,
        height: viewport!.height,
        orientation: viewport!.width > viewport!.height ? "landscape" : "portrait",
      },
    );
    blocking.push(
      ...result.issues
        .filter((issue: AuditIssue) => issue.priority === "P0")
        .map((issue: AuditIssue) => ({ ...issue, variantId: variant.variant })),
    );
  }
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test("portrait and landscape keep tournament result and replay controls usable", async ({
  page,
}, testInfo) => {
  await installDeviceSession(page);
  await page.goto(TOURNAMENT_URL, { waitUntil: "load" });
  await page.getByTestId("tournament-start").click();
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.setupTournamentReviewOverlayFixtureForTest ===
      "function",
  );

  for (const viewport of deviceViewports(testInfo.project.name)) {
    await page.setViewportSize(viewport);
    await page.evaluate(() =>
      window.__BADUGI_E2E__.setupTournamentReviewOverlayFixtureForTest({
        status: "summary",
        variantId: "badugi",
        withReplayTarget: true,
      }),
    );
    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible();
    await expectUsable(page, "mtt-tournament-review-replay");
    await page.getByTestId("mtt-tournament-review-replay").first().click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    const back = page.getByRole("button", { name: "Back to Results" });
    await back.scrollIntoViewIfNeeded();
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible();
  }
});

test("portrait and landscape keep P2P setup buttons pressable", async ({ page }, testInfo) => {
  await installDeviceSession(page);
  await page.goto(FRIEND_MATCH_URL, { waitUntil: "load" });

  for (const viewport of deviceViewports(testInfo.project.name)) {
    await page.setViewportSize(viewport);
    const create = page.getByRole("button", { name: /create room|ルームを作成/i });
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeEnabled();
    const join = page.getByRole("button", { name: /^join$|^参加$/i });
    await join.scrollIntoViewIfNeeded();
    await expect(join).toBeEnabled();
    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.scrollWidth, viewport.name).toBeLessThanOrEqual(metrics.width + 1);
  }

  await page.getByRole("button", { name: /create room|ルームを作成/i }).click();
  await expect(page.getByText("mobile-device-room", { exact: true })).toBeVisible();
  await expectUsable(page, "p2p-ready");
  await page.getByTestId("p2p-ready").click();
  await expect(page.getByTestId("p2p-ready")).toBeDisabled();
});
