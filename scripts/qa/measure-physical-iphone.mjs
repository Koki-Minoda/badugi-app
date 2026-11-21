import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { transformSync } from "esbuild";
const session = JSON.parse(
  fs.readFileSync(
    process.env.MGX_IOS_SESSION ?? "/tmp/mgx-perf-ios-session.json",
    "utf8",
  ),
).value;
const webdriver = `http://127.0.0.1:9450/session/${session.sessionId}`;
const origin = process.env.MGX_PERF_ORIGIN ?? "https://mgx-poker.com";
const cycles = Number(process.env.MGX_PERF_CYCLES ?? 3);
const run = process.env.MGX_PERF_RUN ?? "physical-production";
const folder = path.resolve(
  "reports/mobile-performance",
  run,
  "iphone-16-safari",
);
fs.mkdirSync(folder, { recursive: true });
let cycle = -1,
  leg = "setup";
const rows = [];
function record(kind, data = {}) {
  const row = { at: new Date().toISOString(), cycle, leg, kind, ...data };
  rows.push(row);
  fs.appendFileSync(
    path.join(folder, "measurements.jsonl"),
    JSON.stringify(row) + "\n",
  );
}
async function command(endpoint, body, method = "POST") {
  const response = await fetch(webdriver + endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`${endpoint}: ${data.value?.error} ${data.value?.message}`);
  return data.value;
}
const execute = (script, ...args) => command("/execute/sync", { script, args });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(fn, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timeout in ${leg}`);
}
async function element(selector) {
  return execute("return document.querySelector(arguments[0]);", selector);
}
async function click(selector) {
  const el = await wait(() => element(selector));
  await execute(
    'arguments[0].scrollIntoView({block:"center",inline:"center"});arguments[0].click();',
    el,
  );
}
async function textClick(text, scope = "body") {
  const el = await wait(() =>
    execute(
      'return [...document.querySelectorAll(arguments[1]+" button")].find(b=>b.textContent.trim()===arguments[0]&&!b.disabled&&b.getBoundingClientRect().height>0)??null;',
      text,
      scope,
    ),
  );
  await execute(
    'arguments[0].scrollIntoView({block:"center"});arguments[0].click();',
    el,
  );
}
async function ready(variant) {
  await wait(() =>
    execute(
      'return Boolean(document.querySelector("[data-testid=decision-panel]")&&window.__BADUGI_E2E__?.getStateSnapshot().gameVariant===arguments[0]);',
      variant,
    ),
  );
}
async function select(variant) {
  const target = `[data-testid="game-selector-play-${variant}"]`;
  if (!(await element(target))) {
    const button = await execute(
      'return [...document.querySelectorAll("button")].find(b=>/Triple Draw|トリプルドロー/.test(b.textContent)&&b.getBoundingClientRect().height>0)??null;',
    );
    if (button) await execute("arguments[0].click();", button);
  }
  await click(target);
  await ready(variant);
}
async function enter() {
  await wait(async () => {
    if (await element("[data-testid=menu-ring]")) return true;
    if (await element("[data-testid=title-enter-button]"))
      await click("[data-testid=title-enter-button]");
    return false;
  });
}
async function collect() {
  record("probe", await execute("return window.__MGX_PERF__.read();"));
}
async function timed(name, action) {
  const start = performance.now();
  await action();
  record("transition", { name, ms: performance.now() - start });
}
async function hand() {
  record("hand-start");
  const start = performance.now();
  let clicks = 0,
    lastKey = null;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const state =
      await execute(`const visible=e=>e&&e.getBoundingClientRect().height>0;
   const result=document.querySelector('[data-testid="hand-result-overlay"]');
   const state=window.__BADUGI_E2E__?.getPhaseState();
   const ids=['action-check','action-call','action-draw-selected','action-fold'];
   return {terminal:Boolean(visible(result)),phase:state?.phase,actor:state?.turn,handId:state?.handId,action:ids.find(id=>{const e=document.querySelector('[data-testid="'+id+'"]');return visible(e)&&!e.disabled;})??null};`);
    const key = JSON.stringify([state.phase, state.actor, state.handId]);
    if (key !== lastKey) {
      record("progress", state);
      lastKey = key;
    }
    if (state.terminal) {
      if (!clicks) throw new Error("No real Hero click in hand");
      record("hand", { ms: performance.now() - start, heroClicks: clicks });
      await collect();
      return;
    }
    if (state.action) {
      await click(`[data-testid="${state.action}"]`);
      clicks++;
    } else await sleep(100);
  }
  throw new Error("Physical iPhone hand timeout");
}
async function menu() {
  await click("[data-testid=hand-result-cash-out]");
  await textClick("ゲーム選択", "[role=dialog]");
  await wait(() => element("[data-testid=menu-ring]"));
}
async function cash(variant) {
  await timed(`cash-${variant}`, async () => {
    await click("[data-testid=menu-ring]");
    await select(variant);
  });
  await hand();
}
async function pause() {
  await click("[data-testid=hand-result-next-hand]");
  await wait(() =>
    execute(
      'const e=document.querySelector("[data-testid=hand-result-overlay]");return !e||e.getBoundingClientRect().height===0;',
    ),
  );
  await click('[aria-label="対局メニュー"]');
  await textClick("大会を中断");
  await wait(() => element("[data-testid=menu-ring]"));
}
let token = null;
const password = "MgxE2E!2026";
async function api(route, method, body) {
  const r = await fetch(origin + "/api" + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`API ${route} returned ${r.status}`);
  return data;
}
try {
  await command("/timeouts", { script: 30000, pageLoad: 30000, implicit: 0 });
  const dimensions = await execute(
    'return {width:innerWidth,height:innerHeight,orientation:screen.orientation?.type,platform:navigator.platform,storageKeys:localStorage.length,hasAccount:Boolean(localStorage.getItem("mgx_auth"))};',
  );
  record("physical-device", {
    model: "iPhone 16",
    capabilities: {
      browserName: session.capabilities.browserName,
      browserVersion: session.capabilities.browserVersion,
      platformName: session.capabilities.platformName,
    },
    dimensions,
    inputMethod:
      "scripted DOM button activation; physical touch latency not measured",
  });
  if (dimensions.hasAccount)
    throw new Error(
      "Automation profile already has an account; preserving its data",
    );
  const email = `mgx.perf+${randomUUID()}@mgx-e2e.com`;
  await api("/auth/signup", "POST", { email, password });
  token = (await api("/auth/login", "POST", { email, password })).access_token;
  const user = await api("/auth/me", "GET");
  await execute(
    'localStorage.setItem("mgx_auth",JSON.stringify(arguments[0]));localStorage.setItem("mgx.handResult.autoNext","off");',
    { accessToken: token, tokenType: "Bearer", user, isAuthenticated: true },
  );
  await command("/refresh", {});
  const source = fs.readFileSync(
    "tests/e2e/helpers/mobilePerformanceProbe.ts",
    "utf8",
  );
  const probe =
    transformSync(source, {
      loader: "ts",
      format: "iife",
      globalName: "MGXProbe",
    }).code + ";MGXProbe.installMobilePerformanceProbe();return true;";
  await execute(probe);
  await enter();
  await click("[data-testid=menu-ring]");
  await select("badugi");
  leg = "cold-badugi-cash";
  await hand();
  for (cycle = 0; cycle < cycles; cycle++) {
    await menu();
    leg = "badeucey-cash";
    await cash("badeucey_triple_draw");
    await menu();
    leg = "badugi-after-badeucey";
    await cash("badugi");
    leg = "badeucey-mtt";
    await timed("start-badeucey-mtt", async () => {
      await execute(
        "return window.__BADUGI_E2E__.startTournamentMTT(arguments[0]);",
        {
          id: "physical-perf",
          name: "Physical iPhone performance",
          practiceOnly: true,
          tables: 2,
          seatsPerTable: 6,
          totalPlayers: 12,
          startingStack: 2000,
          gameVariant: "badeucey_triple_draw",
          gameRotation: ["badeucey_triple_draw"],
          rotationPolicy: "fixed",
          levels: [
            {
              levelIndex: 1,
              smallBlind: 5,
              bigBlind: 10,
              ante: 0,
              handsThisLevel: 999,
            },
          ],
          payouts: [{ place: 1, percent: 100 }],
        },
      );
      await ready("badeucey_triple_draw");
    });
    await hand();
    await pause();
    leg = "badugi-after-paused-mtt";
    await cash("badugi");
    await menu();
    leg = "resumed-badeucey-mtt";
    await timed("resume-badeucey-mtt", async () => {
      await click("[data-testid=menu-tournament]");
      await click("[data-testid=tournament-resume]");
      await textClick("次のハンドへ");
      await ready("badeucey_triple_draw");
    });
    await hand();
    await pause();
    await click("[data-testid=menu-tournament]");
    await click("[data-testid=tournament-retire]");
    await textClick("戻る");
    leg = "cycle-boundary";
    await cash("badugi");
  }
  leg = "final-before-reload";
  await collect();
  record(
    "diagnostic-buffer",
    await execute(
      "const rows=window.__BADUGI_E2E__?.drainLogs?.()??[];return {entries:rows.length,characters:rows.reduce((n,s)=>n+s.length,0)};",
    ),
  );
  fs.writeFileSync(
    path.join(folder, "run.json"),
    JSON.stringify(
      { run, cycles, origin, physicalDevice: true, rows },
      null,
      2,
    ) + "\n",
  );
  record("complete");
} catch (error) {
  record("failure", { message: String(error) });
  try {
    const image = await command("/screenshot", undefined, "GET");
    fs.writeFileSync(
      path.join(folder, "failure.png"),
      Buffer.from(image, "base64"),
    );
  } catch {}
  throw error;
} finally {
  if (token) {
    try {
      const deleted = await api("/auth/account", "DELETE", { password });
      record("account-cleanup", { deleted: deleted.deleted === true });
    } catch (error) {
      record("account-cleanup-failure", { message: String(error) });
    }
  }
  if (token)
    await execute('localStorage.removeItem("mgx_auth");').catch(() => {});
  await command("", {}, "DELETE").catch(() => {});
}
