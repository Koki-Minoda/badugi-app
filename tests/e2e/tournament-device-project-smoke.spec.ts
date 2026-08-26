import { expect, test, type Page } from "@playwright/test";
import { APP_URL } from "./authHelper";
import {
  CORE5_VARIANTS,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";
import { evaluateTournamentMobileLayout } from "./helpers/core5TournamentLayoutHelper";

const TOURNAMENT_URL = `${APP_URL.replace(/\/$/, "")}/dev/tournament`;

async function installDeviceSession(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? {
          id: 7002,
          username: "Device Hero",
          email: "device.hero@mgx-e2e.test",
        }
      : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.addInitScript(() => {
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
