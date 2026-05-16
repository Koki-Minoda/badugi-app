import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressState,
  invokeE2E,
  progressKey,
  performSafeAction,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import { assertBrowserGameplayInvariants } from "../../src/ui/qa/assertBrowserGameplayInvariants.js";

const REPORT_DIR = path.resolve("reports/browser-gameplay");
const REPORT_PATH = path.join(REPORT_DIR, "badugi-browser-raise-call-reopen-regression.json");
const TRACE_PATH = path.join(REPORT_DIR, "browser-gameplay-trace-badugi-raise-call-reopen.jsonl");

function writeArtifacts(row: any, trace: any[]) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...row }, null, 2)}\n`);
  fs.writeFileSync(TRACE_PATH, trace.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function playerBet(player: any) {
  return Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0;
}

async function collect(page: any, label: string, action: any, trace: any[]) {
  const row = await page.evaluate(
    ({ label, action }) => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label, mode: "cash", action }),
    { label, action },
  );
  const assertion = assertBrowserGameplayInvariants(row, trace);
  const enriched = { ...row, expected: assertion.expected, violations: assertion.violations };
  trace.push(enriched);
  return enriched;
}

async function openBadugi(page: any) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
  await waitForE2EDriver(page);
  await page.evaluate(() => window.__MGX_CLEAR_GAMEPLAY_TRACE__?.());
}

async function forceAction(page: any, actor: number, payload: any) {
  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  return snapshot;
}

test("Badugi browser trace rejects hero re-action after raise/call closure", async ({ page }) => {
  test.setTimeout(360000);
  const trace: any[] = [];
  await openBadugi(page);
  await collect(page, "initial", null, trace);

  let heroRaiseBefore: any = null;
  let heroRaiseAfter: any = null;
  for (let step = 0; step < 120; step += 1) {
    const progress = await getProgressState(page);
    if (progress?.phase === "BET" && progress.actor === 0 && (await getLegalActions(page)).includes("action-raise")) {
      heroRaiseBefore = progress;
      const key = progressKey(progress);
      await page.getByTestId("action-raise").first().click();
      await waitForProgressChange(page, key, { timeout: 15000 });
      heroRaiseAfter = await getProgressState(page);
      await collect(page, "hero-raise", { actorSeat: 0, type: "RAISE" }, trace);
      break;
    }
    const key = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(acted.acted, JSON.stringify({ step, progress: summarizeProgressState(progress) })).toBe(true);
    await waitForProgressChange(page, key, { timeout: 15000 });
    await collect(page, `setup-${step}`, acted, trace);
  }

  expect(heroRaiseBefore, "hero raise should be reached").toBeTruthy();
  let illegalHeroReAction: any = null;
  let closedState: any = null;

  for (let step = 0; step < 40; step += 1) {
    const progress = await getProgressState(page);
    const sameStreet =
      progress.handId === heroRaiseBefore.handId &&
      progress.phase === "BET" &&
      Number(progress.drawRoundIndex ?? 0) === Number(heroRaiseBefore.drawRoundIndex ?? 0);
    if (!sameStreet) {
      closedState = progress;
      await collect(page, "street-closed", null, trace);
      break;
    }
    if (progress.actor === 0) {
      illegalHeroReAction = {
        progress: summarizeProgressState(progress),
        legalActions: await getLegalActions(page),
      };
      await collect(page, "illegal-hero-reaction", null, trace);
      break;
    }
    const actor = progress.actor;
    expect(typeof actor).toBe("number");
    const player = progress.players?.[actor];
    const toCall = Math.max(0, Number(progress.currentBet ?? 0) - playerBet(player));
    const payload = toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
    const key = progressKey(progress);
    const snapshot = await forceAction(page, actor, payload);
    if (!snapshot) {
      await waitForProgressChange(page, key, { timeout: 2500 }).catch(() => {});
      const after = await getProgressState(page);
      if (progressKey(after) === key) {
        expect(snapshot).toBeTruthy();
      }
    }
    await waitForProgressChange(page, key, { timeout: 15000 });
    await collect(page, `caller-${step}`, { actorSeat: actor, type: payload.type.toUpperCase(), amount: payload.amount ?? 0 }, trace);
  }

  const violations = trace.flatMap((entry) => entry.violations ?? []);
  const row = {
    status: illegalHeroReAction || violations.some((v) => v.severity === "P0") ? "FAIL" : "PASS",
    heroRaiseBefore: summarizeProgressState(heroRaiseBefore),
    heroRaiseAfter: summarizeProgressState(heroRaiseAfter),
    closedState: closedState ? summarizeProgressState(closedState) : null,
    illegalHeroReAction,
    violations,
    tracePath: TRACE_PATH,
  };
  writeArtifacts(row, trace);
  expect(illegalHeroReAction, JSON.stringify(row, null, 2)).toBeNull();
  expect(violations.filter((v) => v.severity === "P0"), JSON.stringify(row, null, 2)).toEqual([]);
});
