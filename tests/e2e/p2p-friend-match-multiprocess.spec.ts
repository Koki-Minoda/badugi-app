import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_URL, gotoWithRetry } from "./authHelper";

const PORT = Number(process.env.P2P_MULTI_E2E_BACKEND_PORT ?? 8003);
const LIVE_ORIGIN = String(process.env.P2P_LIVE_ORIGIN ?? "").replace(/\/$/, "");
const ORIGIN = LIVE_ORIGIN || `http://127.0.0.1:${PORT}`;
const DATABASE_PATH = path.join(os.tmpdir(), `mgx-p2p-multi-${process.pid}-${Date.now()}.sqlite3`);
const PASSWORD = "MgxP2P!2026";
const HANDS = Math.max(1, Number(process.env.P2P_MULTI_E2E_HANDS ?? 50));
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

function backendEnvironment() {
  return {
    ...process.env,
    PYTHONPATH: ".",
    BACKEND_ENV: "local",
    BACKEND_DB_DRIVER: "sqlite",
    BACKEND_DB_NAME: DATABASE_PATH,
    SECRET_KEY: "p2p-multiprocess-e2e-secret-key-32",
    CORS_ORIGINS: '["http://127.0.0.1:3000"]',
  };
}

async function waitForBackend(expectedProcess: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 30_000;
  let consecutiveHealthyChecks = 0;
  while (Date.now() < deadline) {
    if (expectedProcess.exitCode !== null || expectedProcess.signalCode !== null) {
      throw new Error(`Two-worker backend exited before becoming healthy (${expectedProcess.exitCode ?? expectedProcess.signalCode})`);
    }
    try {
      if ((await fetch(`${ORIGIN}/api/health`, { cache: "no-store" })).ok) {
        consecutiveHealthyChecks += 1;
        if (consecutiveHealthyChecks >= 3) return;
      } else {
        consecutiveHealthyChecks = 0;
      }
    } catch {
      consecutiveHealthyChecks = 0;
      // Workers are still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Two-worker backend did not become healthy on ${ORIGIN}`);
}

async function startBackend() {
  if (LIVE_ORIGIN) return;
  const child = spawn(
    pythonCommand(),
    [
      "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT),
      "--workers", "2",
    ],
    { cwd: path.join(process.cwd(), "backend"), env: backendEnvironment() },
  );
  backend = child;
  child.stderr.on("data", (chunk) => process.stderr.write(`[p2p-multi] ${chunk}`));
  await waitForBackend(child);
}

async function migrateDatabase() {
  if (LIVE_ORIGIN) return;
  const migration = spawn(pythonCommand(), ["-m", "alembic", "upgrade", "head"], {
    cwd: path.join(process.cwd(), "backend"),
    env: backendEnvironment(),
  });
  let stderr = "";
  migration.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const exitCode = await new Promise<number | null>((resolve) => {
    migration.once("exit", (code) => resolve(code));
  });
  if (exitCode !== 0) throw new Error(`P2P migration failed (${exitCode}): ${stderr}`);
}

async function stopBackend() {
  if (LIVE_ORIGIN) return;
  const processToStop = backend;
  backend = null;
  if (!processToStop) return;
  const exited = new Promise<void>((resolve) => processToStop.once("exit", () => resolve()));
  processToStop.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${ORIGIN}/api/health`, { cache: "no-store" });
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Two-worker backend still accepts connections on ${ORIGIN} after shutdown`);
}

async function authenticate(page: Page, label: string) {
  const email = `mgx.p2p.multi.${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
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
  await page.addInitScript(({ accessToken, profile, fallbackEmail }) => {
    window.localStorage.setItem("mgx_auth", JSON.stringify({
      accessToken,
      tokenType: "Bearer",
      user: { id: profile.id, username: profile.username, email: fallbackEmail },
      isAuthenticated: true,
    }));
  }, { accessToken: token, profile: user, fallbackEmail: email });
  return { token, user };
}

async function connectToBackend(page: Page, forceRest: boolean) {
  if (!LIVE_ORIGIN) {
    await page.route("**/api/**", async (route) => {
      const incoming = new URL(route.request().url());
      try {
        await route.fulfill({
          response: await route.fetch({ url: `${ORIGIN}${incoming.pathname}${incoming.search}` }),
        });
      } catch {
        // A rolling restart creates a short, legitimate outage. Model it as a
        // retryable upstream response so the product's REST backoff is exercised.
        await route.fulfill({
          status: 503,
          headers: { "content-type": "application/json", "retry-after": "1" },
          body: JSON.stringify({ detail: "backend_restarting" }),
        });
      }
    });
  }
  await page.addInitScript(({ backendPort, restOnly, live }) => {
    if (restOnly) {
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
      Object.defineProperty(window, "WebSocket", { configurable: true, value: FailingWebSocket });
      return;
    }
    const NativeWebSocket = window.WebSocket;
    if (live) return;
    class BackendWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const parsed = new URL(String(url), window.location.href);
        super(
          parsed.pathname.startsWith("/ws/p2p/")
            ? `ws://127.0.0.1:${backendPort}${parsed.pathname}${parsed.search}`
            : parsed.toString(),
          protocols,
        );
      }
    }
    Object.defineProperty(window, "WebSocket", { configurable: true, value: BackendWebSocket });
  }, { backendPort: PORT, restOnly: forceRest, live: Boolean(LIVE_ORIGIN) });
}

async function openPlayer(page: Page, label: string, forceRest: boolean) {
  console.info(`[p2p-soak] authenticating ${label}`);
  const session = await authenticate(page, label);
  await connectToBackend(page, forceRest);
  console.info(`[p2p-soak] opening ${label}`);
  const friendMatchPath = LIVE_ORIGIN ? "friend-match" : "dev/friend-match";
  await gotoWithRetry(page, `${APP_URL.replace(/\/?$/, "/")}${friendMatchPath}`);
  if (LIVE_ORIGIN) {
    const diagnostics = await page.evaluate(() => ({
      href: window.location.href,
      scripts: [...document.querySelectorAll("script[src]")].map((script) => script.getAttribute("src")),
      serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null,
    }));
    console.info(`[p2p-soak] browser=${JSON.stringify(diagnostics)}`);
  }
  console.info(`[p2p-soak] opened ${label}`);
  return session;
}

test.beforeAll(async () => {
  await migrateDatabase();
  await startBackend();
});

test.afterAll(async () => {
  await stopBackend();
  if (!LIVE_ORIGIN) rmSync(DATABASE_PATH, { force: true });
});

test(`${LIVE_ORIGIN ? "production preserves" : "two workers preserve"} a mixed WS/REST room across ${HANDS} hands`, async ({ browser }) => {
  test.setTimeout(Math.max(600_000, HANDS * 12_000));
  const options: Parameters<typeof browser.newContext>[0] = { serviceWorkers: "block" };
  const hostContext: BrowserContext = await browser.newContext(options);
  const guestContext: BrowserContext = await browser.newContext(options);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  if (LIVE_ORIGIN) {
    for (const page of [host, guest]) {
      page.on("response", (response) => {
        if (response.url().includes("/p2p/") || response.status() >= 400) {
          console.info(`[p2p-soak] response=${response.status()} url=${response.url()}`);
        }
      });
    }
  }
  let hostToken = "";
  let guestToken = "";
  try {
    const hostSession = await openPlayer(host, "host", false);
    hostToken = hostSession.token;
    console.info("[p2p-soak] creating room");
    await host.getByRole("button", { name: /Create Room|ルームを作成/i }).click({ timeout: 20_000 });
    const roomCode = (await host.locator("strong").filter({ hasText: /^[A-Z2-9]{6}$/ }).textContent({ timeout: 20_000 }))?.trim();
    expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);
    const guestSession = await openPlayer(guest, "guest", true);
    guestToken = guestSession.token;
    await guest.getByLabel(/Room code|ルームコード/i).fill(roomCode!);
    console.info(`[p2p-soak] joining room=${roomCode}`);
    await guest.getByRole("button", { name: /^Join$|^参加$/i }).click({ timeout: 20_000 });
    await expect(host.getByText(/^connected$/i)).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByText(/^polling$/i)).toBeVisible({ timeout: 20_000 });
    console.info(`[p2p-soak] joined room=${roomCode} scope=${LIVE_ORIGIN ? "production" : "two-worker"} hands=${HANDS}`);

    const privateState = await host.request.get(`${ORIGIN}/api/p2p/rooms/${roomCode}/state`, {
      headers: { Authorization: `Bearer ${hostSession.token}` },
    });
    expect(privateState.headers()["cache-control"]).toBe("private, no-store");

    const sessions = new Map([
      [String(hostSession.user.id), hostSession],
      [String(guestSession.user.id), guestSession],
    ]);
    const stateFor = async (session: typeof hostSession) => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const response = await host.request.get(`${ORIGIN}/api/p2p/rooms/${roomCode}/state`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        if (response.ok()) return response.json();
        if (response.status() !== 429) {
          expect(response.ok(), await response.text()).toBeTruthy();
        }
        const retryAfter = Math.max(1, Number(response.headers()["retry-after"] ?? 1));
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1_000));
      }
      throw new Error("P2P state rate limit did not recover within 30 seconds");
    };
    for (let hand = 0; hand < HANDS; hand += 1) {
      let state = await stateFor(hostSession);
      let guestReadyState: Awaited<ReturnType<typeof stateFor>> | null = null;
      for (const session of [hostSession, guestSession]) {
        const ready = await host.request.post(`${ORIGIN}/api/p2p/rooms/${roomCode}/ready`, {
          headers: { Authorization: `Bearer ${session.token}` },
          data: {
            commandId: `multi-ready-${hand}-${session.user.id}`,
            handId: state.handId,
            expectedPhase: state.phase,
          },
        });
        expect(ready.ok(), await ready.text()).toBeTruthy();
        state = await ready.json();
        if (session === guestSession) guestReadyState = state;
      }
      const hostState = await stateFor(hostSession);
      const guestState = guestReadyState!;
      expect(hostState.hand).toHaveLength(4);
      expect(guestState.hand).toHaveLength(4);
      expect(hostState.hand.filter((card: string) => guestState.hand.includes(card))).toEqual([]);
      expect(hostState.players.every((player: Record<string, unknown>) => !("hand" in player))).toBe(true);

      const actor = sessions.get(String(hostState.currentTurnPlayerId));
      expect(actor).toBeTruthy();
      const folded = await host.request.post(`${ORIGIN}/api/p2p/rooms/${roomCode}/action`, {
        headers: { Authorization: `Bearer ${actor!.token}` },
        data: {
          commandId: `multi-fold-${hand}-${actor!.user.id}`,
          handId: hostState.handId,
          expectedPhase: hostState.phase,
          type: "fold",
          amount: 0,
        },
      });
      expect(folded.ok(), await folded.text()).toBeTruthy();
      const finished = await folded.json();
      expect(finished.phase).toBe("showdown");
      expect(finished.handNumber).toBe(hand + 1);
      await expect(host.getByText(/Showdown winner|ショーダウン勝者/i)).toBeVisible({ timeout: 20_000 });
      if ((hand + 1) % 5 === 0 || hand + 1 === HANDS) {
        console.info(`[p2p-soak] completed=${hand + 1}/${HANDS} sequence=${finished.sequenceId}`);
      }
      if (!LIVE_ORIGIN && hand === Math.floor(HANDS / 2) - 1) {
        await stopBackend();
        await startBackend();
        await expect(host.getByText(/^(connected|polling)$/i)).toBeVisible({ timeout: 30_000 });
        await expect(guest.getByText(/^polling$/i)).toBeVisible({ timeout: 30_000 });
      }
    }

    await expect(host.getByTestId(`p2p-player-${hostSession.user.id}`)).toBeVisible();
    await expect(guest.getByTestId(`p2p-player-${guestSession.user.id}`)).toBeVisible();
    const finalState = await stateFor(hostSession);
    expect(finalState.handNumber).toBe(HANDS);
    expect(finalState.players.reduce(
      (sum: number, player: { stack: number; bet?: number }) => sum + player.stack + Number(player.bet ?? 0),
      Number(finalState.pot ?? 0),
    )).toBe(Number(finalState.config.startingStack) * 2);
    const closed = await host.request.delete(`${ORIGIN}/api/p2p/rooms/${roomCode}`, {
      headers: { Authorization: `Bearer ${hostSession.token}` },
    });
    expect(closed.ok(), await closed.text()).toBeTruthy();
    await expect(guest.getByText(/room was closed|ホストが退出したため/i)).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    if (LIVE_ORIGIN) {
      for (const token of [guestToken, hostToken].filter(Boolean)) {
        await host.request.delete(`${ORIGIN}/api/auth/account`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { password: PASSWORD },
        }).catch(() => null);
      }
    }
    await Promise.all([
      host.unrouteAll({ behavior: "ignoreErrors" }),
      guest.unrouteAll({ behavior: "ignoreErrors" }),
    ]);
    await hostContext.close();
    await guestContext.close();
  }
});
