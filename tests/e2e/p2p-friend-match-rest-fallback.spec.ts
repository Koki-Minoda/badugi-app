import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_URL, gotoWithRetry } from "./authHelper";

const PORT = Number(process.env.P2P_REST_E2E_BACKEND_PORT ?? 8002);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DATABASE_PATH = path.join(os.tmpdir(), `mgx-p2p-rest-${process.pid}-${Date.now()}.sqlite3`);
const PASSWORD = "MgxP2P!2026";
let backend: ChildProcessWithoutNullStreams | null = null;

function pythonCommand() {
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

async function waitForBackend() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${ORIGIN}/api/health`)).ok) return;
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Backend did not start at ${ORIGIN}`);
}

async function openPollingPlayer(page: Page, label: string) {
  const email = `mgx.p2p.rest.${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  expect((await page.request.post(`${ORIGIN}/api/auth/signup`, {
    data: { email, password: PASSWORD },
  })).ok()).toBeTruthy();
  const login = await page.request.post(`${ORIGIN}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { access_token: token } = await login.json();
  const me = await page.request.get(`${ORIGIN}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await me.json();

  await page.route("**/api/**", async (route) => {
    const incoming = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: `${ORIGIN}${incoming.pathname}${incoming.search}` }),
    });
  });
  await page.addInitScript(({ accessToken, profile, fallbackEmail }) => {
    window.localStorage.setItem("mgx_auth", JSON.stringify({
      accessToken,
      tokenType: "Bearer",
      user: { id: profile.id, username: profile.username, email: fallbackEmail },
      isAuthenticated: true,
    }));

    class FailingWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = FailingWebSocket.CONNECTING;
      listeners: Record<string, Array<(event: { code?: number }) => void>> = {};

      constructor() {
        window.setTimeout(() => {
          this.readyState = FailingWebSocket.CLOSED;
          for (const listener of this.listeners.close ?? []) listener({ code: 1006 });
        }, 10);
      }

      addEventListener(type: string, listener: (event: { code?: number }) => void) {
        this.listeners[type] = [...(this.listeners[type] ?? []), listener];
      }

      send() {}
      close() { this.readyState = FailingWebSocket.CLOSED; }
    }
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: FailingWebSocket,
    });
  }, { accessToken: token, profile: user, fallbackEmail: email });

  await gotoWithRetry(page, `${APP_URL}dev/friend-match`);
  await expect(page.getByRole("heading", { name: /Create a Room|プライベート卓を作成/i })).toBeVisible();
  return user;
}

async function enabledPlayer(
  candidates: Array<{ label: string; page: Page }>,
  testId: string,
) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (await candidate.page.locator(`[data-testid="${testId}"]:not([disabled])`).count()) {
        return candidate;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${testId} did not become enabled`);
}

test.beforeAll(async () => {
  backend = spawn(pythonCommand(), [
    "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT),
  ], {
    cwd: path.join(process.cwd(), "backend"),
    env: {
      ...process.env,
      PYTHONPATH: ".",
      BACKEND_ENV: "local",
      BACKEND_DB_DRIVER: "sqlite",
      BACKEND_DB_NAME: DATABASE_PATH,
      SECRET_KEY: "p2p-rest-e2e-secret",
      CORS_ORIGINS: '["http://127.0.0.1:3000"]',
    },
  });
  await waitForBackend();
});

test.afterAll(async () => {
  backend?.kill("SIGTERM");
  backend = null;
  rmSync(DATABASE_PATH, { force: true });
});

test("two players finish a major Badugi flow after WebSocket failure", async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({ serviceWorkers: "block" });
  const guestContext = await browser.newContext({ serviceWorkers: "block" });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const players = [{ label: "host", page: host }, { label: "guest", page: guest }];
  try {
    await openPollingPlayer(host, "host");
    await host.getByRole("button", { name: /Create Room|ルームを作成/i }).click();
    const roomCode = (await host.locator("strong").filter({ hasText: /^[A-Z2-9]{6}$/ }).textContent())?.trim();
    expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);
    await expect(host.getByText(/^polling$/i)).toBeVisible({ timeout: 10_000 });

    await openPollingPlayer(guest, "guest");
    await guest.getByLabel(/Room code|ルームコード/i).fill(roomCode!);
    await guest.getByRole("button", { name: /^Join$|^参加$/i }).click();
    await expect(guest.getByText(/^polling$/i)).toBeVisible({ timeout: 10_000 });

    await host.getByTestId("p2p-ready").click();
    await guest.getByTestId("p2p-ready").click();
    await expect(host.getByTestId("p2p-private-hand").locator("button")).toHaveCount(4, { timeout: 10_000 });
    await expect(guest.getByTestId("p2p-private-hand").locator("button")).toHaveCount(4, { timeout: 10_000 });
    const hostCards = await host.getByTestId("p2p-private-hand").locator("button").allTextContents();
    const guestCards = await guest.getByTestId("p2p-private-hand").locator("button").allTextContents();
    expect(hostCards.filter((card) => guestCards.includes(card))).toEqual([]);

    const caller = await enabledPlayer(players, "p2p-call");
    await caller.page.getByTestId("p2p-call").click();
    const checker = caller.label === "host" ? guest : host;
    await expect(checker.getByTestId("p2p-check")).toBeVisible({ timeout: 10_000 });
    await checker.getByTestId("p2p-check").click();

    const firstDrawer = await enabledPlayer(players, "p2p-draw");
    const secondDrawer = firstDrawer.label === "host" ? guest : host;
    await firstDrawer.page.getByTestId("p2p-card-0").click();
    await firstDrawer.page.getByTestId("p2p-draw").click();
    await expect(secondDrawer.getByTestId("p2p-draw")).toBeEnabled({ timeout: 10_000 });
    await secondDrawer.getByTestId("p2p-draw").click();

    const bettor = await enabledPlayer(players, "p2p-bet");
    const folder = bettor.label === "host" ? guest : host;
    await bettor.page.getByTestId("p2p-bet").click();
    await expect(folder.getByTestId("p2p-fold")).toBeEnabled({ timeout: 10_000 });
    await folder.getByTestId("p2p-fold").click();
    await expect(host.getByText(/Showdown winner|ショーダウン勝者/i)).toBeVisible({ timeout: 10_000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
