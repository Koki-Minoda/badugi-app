import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_URL, gotoWithRetry } from "./authHelper";

const BACKEND_PORT = Number(process.env.P2P_E2E_BACKEND_PORT ?? 8001);
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const HEALTH_URL = `${BACKEND_ORIGIN}/api/health`;
const PASSWORD = "MgxP2P!2026";
const DATABASE_PATH = path.join(
  os.tmpdir(),
  `mgx-p2p-playwright-${process.pid}-${Date.now()}.sqlite3`,
);

let backendProcess: ChildProcessWithoutNullStreams | null = null;

function resolvePythonCommand() {
  if (process.env.P2P_E2E_PYTHON) {
    return path.isAbsolute(process.env.P2P_E2E_PYTHON)
      ? process.env.P2P_E2E_PYTHON
      : path.resolve(process.cwd(), process.env.P2P_E2E_PYTHON);
  }
  if (process.platform === "win32") return "python";
  for (const candidate of [".venv-p2p/bin/python", ".venv-qa/bin/python", ".venv/bin/python"]) {
    const absolute = path.join(process.cwd(), candidate);
    if (existsSync(absolute)) return absolute;
  }
  return "python3";
}

async function backendIsHealthy() {
  try {
    return (await fetch(HEALTH_URL)).ok;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await backendIsHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Canonical backend/app did not become healthy on ${BACKEND_ORIGIN}`);
}

async function authenticate(page: Page, label: string) {
  const email = `mgx.p2p.${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const signup = await page.request.post(`${BACKEND_ORIGIN}/api/auth/signup`, {
    data: { email, password: PASSWORD },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  const login = await page.request.post(`${BACKEND_ORIGIN}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const loginPayload = await login.json();
  const token = loginPayload.access_token as string;

  const me = await page.request.get(`${BACKEND_ORIGIN}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(me.ok(), await me.text()).toBeTruthy();
  const user = await me.json();

  await page.addInitScript(
    ({ accessToken, profile, fallbackEmail }) => {
      window.localStorage.setItem(
        "mgx_auth",
        JSON.stringify({
          accessToken,
          tokenType: "Bearer",
          user: {
            id: profile.id,
            username: profile.username,
            email: fallbackEmail,
          },
          isAuthenticated: true,
        }),
      );
    },
    { accessToken: token, profile: user, fallbackEmail: email },
  );

  return { token, user };
}

async function connectPageToCanonicalBackend(page: Page) {
  await page.route("**/api/**", async (route) => {
    const incoming = new URL(route.request().url());
    const response = await route.fetch({
      url: `${BACKEND_ORIGIN}${incoming.pathname}${incoming.search}`,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript((backendPort) => {
    const NativeWebSocket = window.WebSocket;
    class CanonicalBackendWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const parsed = new URL(String(url), window.location.href);
        const rewritten = parsed.pathname.startsWith("/ws/p2p/")
          ? `ws://127.0.0.1:${backendPort}${parsed.pathname}${parsed.search}`
          : parsed.toString();
        super(rewritten, protocols);
      }
    }
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: CanonicalBackendWebSocket,
    });
  }, BACKEND_PORT);
}

async function openFriendMatch(page: Page, label: string) {
  const session = await authenticate(page, label);
  await connectPageToCanonicalBackend(page);
  await gotoWithRetry(page, `${APP_URL}dev/friend-match`);
  await expect(
    page.getByRole("heading", { name: /Create a Room|プライベート卓を作成/i }),
  ).toBeVisible();
  return session;
}

async function privateCards(page: Page) {
  const hand = page.getByTestId("p2p-private-hand");
  await expect(hand.locator("button")).toHaveCount(4, { timeout: 15_000 });
  return hand.locator("button").allTextContents();
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid"),
          className: String(element.className ?? "").slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((entry) => entry.right > document.documentElement.clientWidth + 2 || entry.left < -2)
      .sort((a, b) => b.right - a.right)
      .slice(0, 8),
  }));
  expect(
    geometry.scrollWidth,
    `horizontal overflow offenders: ${JSON.stringify(geometry.offenders)}`,
  ).toBeLessThanOrEqual(geometry.clientWidth + 2);
}

async function clickFirstEnabled(page: Page, testIds: string[]) {
  for (const testId of testIds) {
    const button = page.getByTestId(testId);
    if ((await button.count()) && (await button.isVisible()) && (await button.isEnabled())) {
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box, `${testId} needs a clickable box`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(844 + 2);
      await button.click();
      return testId;
    }
  }
  throw new Error(`No enabled P2P action found: ${testIds.join(", ")}`);
}

async function waitForEnabledPage(
  candidates: Array<{ label: string; page: Page }>,
  testId: string,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (await candidate.page.locator(`[data-testid="${testId}"]:not([disabled])`).count()) {
        return candidate;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${testId} did not become enabled for either player`);
}

async function waitForEnabledAction(
  candidates: Array<{ label: string; page: Page }>,
  testIds: string[],
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      for (const testId of testIds) {
        if (await candidate.page.locator(`[data-testid="${testId}"]:not([disabled])`).count()) {
          return { ...candidate, testId };
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No P2P player received an enabled action: ${testIds.join(", ")}`);
}

test.beforeAll(async () => {
  if (await backendIsHealthy()) return;
  backendProcess = spawn(
    resolvePythonCommand(),
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(BACKEND_PORT),
    ],
    {
      cwd: path.join(process.cwd(), "backend"),
      env: {
        ...process.env,
        PYTHONPATH: ".",
        BACKEND_ENV: "local",
        BACKEND_DB_DRIVER: "sqlite",
        BACKEND_DB_NAME: DATABASE_PATH,
        SECRET_KEY: "p2p-e2e-only-secret-key",
        CORS_ORIGINS: '["http://127.0.0.1:3000"]',
      },
    },
  );
  await waitForBackend();
});

test.afterAll(async () => {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
  rmSync(DATABASE_PATH, { force: true });
});

test.describe("production P2P friend match websocket", () => {
  test.describe.configure({ timeout: 120_000 });

  test("two authenticated mobile players can reconnect, draw, and act without leaking cards", async ({
    browser,
  }) => {
    const mobileOptions: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      serviceWorkers: "block",
    };
    const hostContext: BrowserContext = await browser.newContext(mobileOptions);
    const guestContext: BrowserContext = await browser.newContext(mobileOptions);
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      const hostSession = await openFriendMatch(host, "host");
      await host.getByRole("button", { name: /Create Room|ルームを作成/i }).click();
      await expect(host.getByText(/Room created|ルームを作成しました/i)).toBeVisible();
      const roomCode = (
        await host.locator("strong").filter({ hasText: /^[A-Z2-9]{6}$/ }).first().textContent()
      )?.trim();
      expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);

      const guestSession = await openFriendMatch(guest, "guest");
      await guest.getByLabel(/Room code|ルームコード/i).fill(roomCode!);
      await guest.getByRole("button", { name: /^Join$|^参加$/i }).click();
      await expect(guest.getByText(/Joined room|ルームに参加しました/i)).toBeVisible();

      await expect(host.getByText(/^connected$/i)).toBeVisible({ timeout: 15_000 });
      await expect(guest.getByText(/^connected$/i)).toBeVisible({ timeout: 15_000 });
      await host.getByTestId("p2p-ready").click();
      await guest.getByTestId("p2p-ready").click();

      const hostCardsBeforeReload = await privateCards(host);
      const guestCards = await privateCards(guest);
      expect(new Set(hostCardsBeforeReload).size).toBe(4);
      expect(new Set(guestCards).size).toBe(4);
      expect(hostCardsBeforeReload.filter((card) => guestCards.includes(card))).toEqual([]);
      expect(await host.locator("body").innerText()).not.toContain(guestCards.join(" "));
      expect(await guest.locator("body").innerText()).not.toContain(hostCardsBeforeReload.join(" "));

      await host.reload({ waitUntil: "load" });
      await expect(host.getByText(/^connected$/i)).toBeVisible({ timeout: 15_000 });
      expect(await privateCards(host)).toEqual(hostCardsBeforeReload);
      await expect(host.getByTestId(`p2p-player-${hostSession.user.id}`)).toBeVisible();
      await expect(guest.getByTestId(`p2p-player-${guestSession.user.id}`)).toBeVisible();

      await expectNoHorizontalOverflow(host);
      const opener = await waitForEnabledAction(
        [
          { label: "host", page: host },
          { label: "guest", page: guest },
        ],
        ["p2p-call", "p2p-check"],
      );
      expect(opener.testId).toBe("p2p-call");
      await opener.page.getByTestId(opener.testId).click();
      const responder = opener.label === "host" ? guest : host;
      const response = await waitForEnabledAction(
        [{ label: opener.label === "host" ? "guest" : "host", page: responder }],
        ["p2p-check", "p2p-call"],
      );
      await response.page.getByTestId(response.testId).click();

      const firstDrawer = await waitForEnabledPage(
        [
          { label: "host", page: host },
          { label: "guest", page: guest },
        ],
        "p2p-draw",
      );
      const secondDrawer = firstDrawer.label === "host" ? guest : host;
      await firstDrawer.page.getByTestId("p2p-card-0").click();
      await firstDrawer.page.getByTestId("p2p-draw").click();
      await expect(secondDrawer.getByTestId("p2p-draw")).toBeEnabled({ timeout: 15_000 });
      await secondDrawer.getByTestId("p2p-draw").click();

      await expect(host.getByTestId("p2p-private-hand").locator("button")).toHaveCount(4);
      const bettor = await waitForEnabledPage(
        [
          { label: "host", page: host },
          { label: "guest", page: guest },
        ],
        "p2p-bet",
      );
      const foldPage = bettor.label === "host" ? guest : host;
      await bettor.page.getByTestId("p2p-bet").click();
      await expect(foldPage.getByTestId("p2p-fold")).toBeEnabled({ timeout: 15_000 });
      await foldPage.getByTestId("p2p-fold").click();
      await expect(host.getByText(/Showdown winner|ショーダウン勝者/i)).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });
});
