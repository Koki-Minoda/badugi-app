#!/usr/bin/env node
// Isolated browser timing for the local MTT start path. It creates no account.
import { createRequire } from 'node:module';
import { buildTournamentConfigFromStage } from '../src/config/tournamentStages.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.env.MGX_APP_URL ?? 'https://mgx-poker.com/game';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const messages = new Map();
  const errors = [];
  page.on('console', (message) => {
    const text = message.text();
    const tag = text.match(/^\[[^\]]+\]/)?.[0] ?? '(untagged)';
    messages.set(tag, (messages.get(tag) ?? 0) + 1);
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    window.__mttStorageTimings = {};
    Storage.prototype.setItem = function (key, value) {
      const started = performance.now();
      try { return original.call(this, key, value); }
      finally {
        const slot = window.__mttStorageTimings[key] ?? { count: 0, ms: 0, bytes: 0 };
        slot.count += 1;
        slot.ms += performance.now() - started;
        slot.bytes += String(value).length;
        window.__mttStorageTimings[key] = slot;
      }
    };
  });
  const navStarted = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__BADUGI_E2E__?.startTournamentMTT === 'function', null, { timeout: 60000 });
  const helperReadyMs = Date.now() - navStarted;
  const config = buildTournamentConfigFromStage('local');
  const started = Date.now();
  const syncMs = await page.evaluate((mtConfig) => {
    const t = performance.now();
    window.__BADUGI_E2E__.startTournamentMTT(mtConfig);
    return performance.now() - t;
  }, config);
  await page.waitForFunction(() => {
    const s = window.__BADUGI_E2E__?.getPhaseState?.();
    return Boolean(s?.handId && (s.phase === 'BET' || s.phase === 'DRAW'));
  }, null, { timeout: 60000 });
  const firstHandMs = Date.now() - started;
  let heroTurnMs = null;
  try {
    await page.waitForFunction(() => {
      const s = window.__BADUGI_E2E__?.getPhaseState?.();
      return s?.turn === 0 || s?.phase === 'HAND_RESULT';
    }, null, { timeout: 30000 });
    heroTurnMs = Date.now() - started;
  } catch { /* Record a missing turn instead of masking the timing result. */ }
  const summary = await page.evaluate(() => ({
    phase: window.__BADUGI_E2E__?.getPhaseState?.().phase,
    turn: window.__BADUGI_E2E__?.getPhaseState?.().turn,
    handIdPresent: Boolean(window.__BADUGI_E2E__?.getPhaseState?.().handId),
    storageTimings: window.__mttStorageTimings,
    capturedLogCount: window.__BADUGI_E2E__?.captureConsole?.().length ?? null,
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
  }));
  console.log(JSON.stringify({ url, stage: 'local', entrants: config.totalPlayers,
    helperReadyMs, syncMs, firstHandMs, heroTurnMs, ...summary,
    browserConsoleTags: Object.fromEntries(messages), pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
