import { expect, test, type Page } from "@playwright/test";
import { APP_URL } from "./authHelper";

const ACTIVE_MTT_KEY = "mgx.tournament.mtt.active";
const TOURNAMENT_URL = `${APP_URL.replace(/\/$/, "")}/dev/tournament`;

async function installLocalAuthenticatedSession(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? {
          id: 7001,
          username: "Reconnect Hero",
          email: "reconnect.hero@mgx-e2e.test",
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
        accessToken: "local-tournament-reconnect-token",
        tokenType: "Bearer",
        user: {
          id: 7001,
          username: "Reconnect Hero",
          email: "reconnect.hero@mgx-e2e.test",
        },
        isAuthenticated: true,
      }),
    );
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
}

test.describe("tournament reconnect UI", () => {
  test("reloads the hub, resumes the saved boundary, deals the next hand, and retires", async ({
    page,
  }) => {
    await installLocalAuthenticatedSession(page);
    await page.goto(TOURNAMENT_URL, { waitUntil: "load" });

    await expect(page.getByTestId("tournament-start")).toBeEnabled();
    await page.getByTestId("tournament-start").click();
    await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("seat-0-name")).toHaveText("Reconnect Hero");

    const savedBeforeReconnect = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, ACTIVE_MTT_KEY);
    expect(savedBeforeReconnect?.version).toBe(1);
    expect(savedBeforeReconnect?.hero?.playerId).toBe("hero-player");

    // A reconnect lands on the hub; a full reload proves that the resume panel
    // is reconstructed from persisted state instead of React memory.
    await page.goto(TOURNAMENT_URL, { waitUntil: "load" });
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("tournament-resume-panel")).toBeVisible();
    await page.getByTestId("tournament-resume").click();

    await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("seat-0-name")).toHaveText("Reconnect Hero");
    const nextHand = page.getByRole("button", { name: /Next Hand|次のハンド/i });
    if (await nextHand.isVisible().catch(() => false)) {
      await nextHand.click();
    }

    await page.waitForFunction(
      () => {
        const snapshot = window.__BADUGI_E2E__?.getStateSnapshot?.();
        return Boolean(
          snapshot?.handId &&
            !["WAITING_NEXT_HAND", "SAFE_RESET"].includes(
              String(snapshot.phase ?? "").toUpperCase(),
            ),
        );
      },
      undefined,
      { timeout: 20_000 },
    );
    const resumedState = await page.evaluate(() =>
      window.__BADUGI_E2E__?.getStateSnapshot?.(),
    );
    expect(resumedState?.handId).toEqual(expect.any(String));
    expect(
      ["WAITING_NEXT_HAND", "SAFE_RESET"].includes(
        String(resumedState?.phase ?? "").toUpperCase(),
      ),
    ).toBe(false);

    await page.goto(TOURNAMENT_URL, { waitUntil: "load" });
    await expect(page.getByTestId("tournament-resume-panel")).toBeVisible();
    await page.getByTestId("tournament-retire").click();
    await expect(page.getByTestId("tournament-resume-panel")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), ACTIVE_MTT_KEY))
      .toBeNull();
  });
});
