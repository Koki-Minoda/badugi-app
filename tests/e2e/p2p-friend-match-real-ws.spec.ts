import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { APP_URL, gotoWithRetry } from "./authHelper";

const P2P_BACKEND_PORT = 8001;
const P2P_BACKEND_ORIGIN = `http://127.0.0.1:${P2P_BACKEND_PORT}`;
const API_HEALTH_URL = `${P2P_BACKEND_ORIGIN}/api/health`;

let backendProcess: ChildProcessWithoutNullStreams | null = null;

function resolvePythonCommand() {
  if (process.platform === "win32") return "python";
  const venvPython = path.join(process.cwd(), ".venv/bin/python");
  return existsSync(venvPython) ? venvPython : "python3";
}

async function isBackendHealthy() {
  try {
    const response = await fetch(API_HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for src/server backend on port ${P2P_BACKEND_PORT}`);
}

test.beforeAll(async () => {
  if (await isBackendHealthy()) return;
  backendProcess = spawn(
    resolvePythonCommand(),
    [
      "-m",
      "uvicorn",
      "server.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(P2P_BACKEND_PORT),
    ],
    {
      cwd: path.join(process.cwd(), "src"),
      env: { ...process.env, PYTHONPATH: "." },
    },
  );
  await waitForBackend();
});

test.afterAll(async () => {
  if (!backendProcess) return;
  backendProcess.kill("SIGTERM");
  backendProcess = null;
});

async function openFriendMatch(page: Page) {
  await page.route(/\/api\/rooms(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const original = new URL(route.request().url());
    const response = await route.fetch({
      url: `${P2P_BACKEND_ORIGIN}/api/rooms${original.pathname.split("/api/rooms")[1]}${original.search}`,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript((backendPort) => {
    const NativeWebSocket = window.WebSocket;
    function RewrittenWebSocket(url, protocols) {
      const raw = String(url);
      const rewritten = raw.includes("/ws/room/")
        ? raw.replace(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`, `ws://127.0.0.1:${backendPort}`)
        : raw;
      return protocols === undefined
        ? new NativeWebSocket(rewritten)
        : new NativeWebSocket(rewritten, protocols);
    }
    RewrittenWebSocket.prototype = NativeWebSocket.prototype;
    Object.defineProperties(RewrittenWebSocket, {
      CONNECTING: { value: NativeWebSocket.CONNECTING },
      OPEN: { value: NativeWebSocket.OPEN },
      CLOSING: { value: NativeWebSocket.CLOSING },
      CLOSED: { value: NativeWebSocket.CLOSED },
    });
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: RewrittenWebSocket,
    });
  }, P2P_BACKEND_PORT);
  await gotoWithRetry(page, `${APP_URL}dev/friend-match`);
  await expect(page.getByRole("heading", { name: /Create a Room|プライベート卓を作成/i })).toBeVisible();
}

test.describe("P2P friend match real websocket smoke", () => {
  test.describe.configure({ timeout: 90000 });

  test("host and guest can join, act in turn, reach showdown, and receive next hand", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await openFriendMatch(host);
      await host.getByRole("button", { name: /Create Room|ルームを作成/i }).click();
      await expect(host.getByText(/Room created|ルームを作成しました/i)).toBeVisible({ timeout: 15000 });
      const roomId = (await host.locator("strong").filter({ hasText: /^room-/ }).first().textContent())?.trim();
      expect(roomId).toMatch(/^room-/);

      await openFriendMatch(guest);
      await guest.getByLabel(/Room code|ルームコード/i).fill(roomId ?? "");
      await guest.getByRole("button", { name: /^Join$|^参加$/i }).click();
      await expect(guest.getByText(/Joined room|ルームに参加しました/i)).toBeVisible({ timeout: 15000 });

      await expect(host.getByText(/PLAYING \/ Pot 0/i)).toBeVisible({ timeout: 20000 });
      await expect(guest.getByText(/PLAYING \/ Pot 0/i)).toBeVisible({ timeout: 20000 });

      await host.reload();
      await expect(host.getByText(/^connected$/i)).toBeVisible({ timeout: 20000 });
      await expect(host.getByText(/PLAYING \/ Pot 0/i)).toBeVisible({ timeout: 20000 });

      await host.getByTestId("p2p-call").click();
      await expect(guest.getByText(/Current turn: Your turn|現在の手番: あなたの手番です/i)).toBeVisible({
        timeout: 15000,
      });

      await guest.getByTestId("p2p-fold").click();
      await expect(host.getByText(/Showdown winner|ショーダウン勝者/i)).toBeVisible({ timeout: 15000 });
      await expect(host.getByText("secure_deal").first()).toBeVisible({ timeout: 20000 });
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  test("mobile landscape can open friend match controls without page overflow", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    try {
      await openFriendMatch(page);
      await expect(page.getByRole("button", { name: /Create Room|ルームを作成/i })).toBeVisible();
      const bodyOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(bodyOverflow.scrollWidth).toBeLessThanOrEqual(bodyOverflow.clientWidth + 2);
    } finally {
      await context.close().catch(() => {});
    }
  });
});
