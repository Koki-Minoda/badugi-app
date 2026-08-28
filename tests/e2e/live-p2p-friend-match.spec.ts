import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  APP_URL,
  API_URL,
  createAuthenticatedSession,
  gotoWithRetry,
} from "./authHelper";

const LIVE_ENABLED = process.env.MGX_LIVE_P2P === "1";
type AuthSession = Awaited<ReturnType<typeof createAuthenticatedSession>>;
let cleanupSessions: AuthSession[] = [];

async function deleteLiveSession(session: AuthSession) {
  const token = session.authState.accessToken;
  const authorization = `${session.authState.tokenType} ${token}`;
  const deletion = await fetch(`${API_URL}/auth/account`, {
    method: "DELETE",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ password: session.password }),
  });
  expect(deletion.status, await deletion.text()).toBe(200);
  const stale = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: authorization } });
  expect(stale.status).toBe(401);
}

async function openFriendMatch(page: Page) {
  const session = await createAuthenticatedSession(page);
  await gotoWithRetry(page, `${APP_URL}friend-match`);
  await expect(page.getByRole("heading", { name: /Create a Room|プライベート卓を作成/i })).toBeVisible();
  return session;
}

async function privateCards(page: Page) {
  const cards = page.getByTestId("p2p-private-hand").locator("button");
  await expect(cards).toHaveCount(4, { timeout: 20_000 });
  return cards.allTextContents();
}

async function waitForActor(pages: Page[], ids: string[]) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const page of pages) {
      for (const id of ids) {
        if (await page.locator(`[data-testid="${id}"]:not([disabled])`).count()) return { page, id };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No enabled P2P action: ${ids.join(", ")}`);
}

test.describe("live P2P friend match", () => {
  test.skip(!LIVE_ENABLED, "Set MGX_LIVE_P2P=1 to run against an explicitly selected live environment");
  test.describe.configure({ timeout: 150_000 });
  test.afterEach(async () => {
    const sessions = cleanupSessions;
    cleanupSessions = [];
    for (const session of sessions.reverse()) await deleteLiveSession(session);
  });

  test("two real accounts create, join, reconnect, act privately, leave, and are deleted", async ({ browser }) => {
    const options: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      serviceWorkers: "block",
    };
    const hostContext: BrowserContext = await browser.newContext(options);
    const guestContext: BrowserContext = await browser.newContext(options);
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    let hostSession: Awaited<ReturnType<typeof createAuthenticatedSession>> | null = null;
    let guestSession: Awaited<ReturnType<typeof createAuthenticatedSession>> | null = null;

    try {
      hostSession = await openFriendMatch(host);
      cleanupSessions.push(hostSession);
      const createResponses: Array<{ url: string; status: number; method: string }> = [];
      host.on("response", (response) => {
        createResponses.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      });
      await host.getByRole("button", { name: /Create Room|ルームを作成/i }).click();
      await expect(host.locator("strong").filter({ hasText: /^[A-Z2-9]{6}$/ }).first()).toBeVisible({ timeout: 20_000 }).catch(async () => {
        throw new Error(`P2P create did not produce a room: ${JSON.stringify({
          status: await host.locator("p").allTextContents(),
          responses: createResponses.filter((entry) => entry.method === "POST"),
        })}`);
      });
      expect(createResponses).toContainEqual({ url: `${API_URL}/p2p/rooms`, status: 200, method: "POST" });
      const roomCode = (
        await host.locator("strong").filter({ hasText: /^[A-Z2-9]{6}$/ }).first().textContent()
      )?.trim();
      expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);

      guestSession = await openFriendMatch(guest);
      cleanupSessions.push(guestSession);
      await guest.getByLabel(/Room code|ルームコード/i).fill(roomCode!);
      const [joinResponse] = await Promise.all([
        guest.waitForResponse((response) => response.url().includes("/p2p/") && response.request().method() === "POST", { timeout: 20_000 }),
        guest.getByRole("button", { name: /^Join$|^参加$/i }).click(),
      ]);
      expect(joinResponse.status(), await joinResponse.text()).toBe(200);
      await expect(host.getByText(/^(connected|polling)$/i)).toBeVisible({ timeout: 20_000 });
      await expect(guest.getByText(/^(connected|polling)$/i)).toBeVisible({ timeout: 20_000 });
      await host.getByTestId("p2p-ready").click();
      await guest.getByTestId("p2p-ready").click();

      const hostCards = await privateCards(host);
      const guestCards = await privateCards(guest);
      expect(new Set([...hostCards, ...guestCards]).size).toBe(8);
      expect(await host.getByTestId("p2p-private-hand").textContent()).not.toContain(guestCards.join(" "));
      expect(await guest.getByTestId("p2p-private-hand").textContent()).not.toContain(hostCards.join(" "));

      await host.reload({ waitUntil: "load" });
      await expect(host.getByText(/^(connected|polling)$/i)).toBeVisible({ timeout: 20_000 });
      expect(await privateCards(host)).toEqual(hostCards);
      const geometry = await host.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

      const opener = await waitForActor([host, guest], ["p2p-call", "p2p-check"]);
      await opener.page.getByTestId(opener.id).click();
      const responder = opener.page === host ? guest : host;
      const reply = await waitForActor([responder], ["p2p-check", "p2p-call"]);
      await reply.page.getByTestId(reply.id).click();

      await guest.getByTestId("p2p-leave").click();
      await expect(guest.getByRole("heading", { name: /Create a Room|プライベート卓を作成/i })).toBeVisible();
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
