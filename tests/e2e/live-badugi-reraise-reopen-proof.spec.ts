import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { openLiveGame, writeLiveReport } from "./helpers/liveCore5Helper";
import {
  getLegalActions,
  getProgressState,
  invokeE2E,
  performSafeAction,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/browser-gameplay/live-badugi-reraise-proof.json");
const rows: any[] = [];

function contribution(player: any) {
  return Math.max(0, Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0);
}

function sameBettingStreet(left: any, right: any) {
  return (
    left?.handId === right?.handId &&
    String(left?.phase ?? "") === "BET" &&
    String(right?.phase ?? "") === "BET" &&
    Number(left?.drawRoundIndex ?? 0) === Number(right?.drawRoundIndex ?? 0)
  );
}

function callOrCheck(progress: any) {
  const actorPlayer = typeof progress?.actor === "number" ? progress?.players?.[progress.actor] : null;
  const toCall = Math.max(0, Number(progress?.currentBet ?? 0) - contribution(actorPlayer));
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

async function forceBetAction(page: any, actor: number, payload: any) {
  return (
    (await invokeE2E(page, "forceControllerAction", actor, payload)) ??
    (await invokeE2E(page, "forceSeatAction", actor, payload))
  );
}

async function reachHeroRaise(page: any) {
  await openLiveGame(page, { variant: "badugi" });
  await waitForE2EDriver(page);
  for (let step = 0; step < 100; step += 1) {
    const progress = await getProgressState(page);
    if (progress?.isTerminal) break;
    const legalActions = await getLegalActions(page);
    if (progress?.phase === "BET" && progress?.actor === 0 && legalActions.some((id: string) => id.includes("raise"))) {
      const beforeKey = progressKey(progress);
      await page.getByTestId("action-raise").first().click();
      await waitForProgressChange(page, beforeKey, { timeout: 15000 });
      return { before: progress, after: await getProgressState(page) };
    }
    const beforeKey = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(acted.acted, `setup action should progress: ${JSON.stringify({ step, progress: summarizeProgressState(progress) })}`).toBe(true);
    await waitForProgressChange(page, beforeKey, { timeout: 15000 });
  }
  throw new Error("Live Badugi did not reach a hero raise decision");
}

test.describe("Live Badugi re-raise reopen proof", () => {
  test.describe.configure({ timeout: 360000 });

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    writeLiveReport(REPORT_PATH, rows, { liveUrl: "https://mgx-poker.com/" });
    expect(rows.filter((row) => row.status === "FAIL"), JSON.stringify(rows, null, 2)).toEqual([]);
  });

  test("reopens hero action only after an opponent re-raises", async ({ page }) => {
    const heroRaise = await reachHeroRaise(page);
    let illegalHeroReAction: any = null;
    let closedState: any = null;

    for (let step = 0; step < 30; step += 1) {
      const progress = await getProgressState(page);
      if (!sameBettingStreet(heroRaise.before, progress)) {
        closedState = progress;
        break;
      }
      if (progress.actor === 0) {
        illegalHeroReAction = summarizeProgressState(progress);
        break;
      }
      const key = progressKey(progress);
      expect(await forceBetAction(page, progress.actor, callOrCheck(progress))).toBeTruthy();
      await waitForProgressChange(page, key, { timeout: 15000 });
    }

    rows.push({
      case: "no-reraise",
      status: illegalHeroReAction ? "FAIL" : "PASS",
      heroRaiseBefore: summarizeProgressState(heroRaise.before),
      closedState: summarizeProgressState(closedState ?? (await getProgressState(page))),
      illegalHeroReAction,
    });
    expect(illegalHeroReAction).toBeNull();

    const second = await reachHeroRaise(page);
    const firstOpponent = await getProgressState(page);
    expect(firstOpponent.phase).toBe("BET");
    expect(firstOpponent.actor).not.toBe(0);
    const key = progressKey(firstOpponent);
    expect(await forceBetAction(page, firstOpponent.actor, { type: "raise", amount: 20 })).toBeTruthy();
    await waitForProgressChange(page, key, { timeout: 15000 });

    let heroReopenedState: any = null;
    for (let step = 0; step < 30; step += 1) {
      const progress = await getProgressState(page);
      if (!sameBettingStreet(second.before, progress)) break;
      if (progress.actor === 0) {
        heroReopenedState = progress;
        break;
      }
      const stepKey = progressKey(progress);
      expect(await forceBetAction(page, progress.actor, callOrCheck(progress))).toBeTruthy();
      await waitForProgressChange(page, stepKey, { timeout: 15000 });
    }

    rows.push({
      case: "reraise-positive",
      status: heroReopenedState ? "PASS" : "FAIL",
      heroRaiseBefore: summarizeProgressState(second.before),
      firstOpponentBeforeReraise: summarizeProgressState(firstOpponent),
      heroReopenedState: heroReopenedState ? summarizeProgressState(heroReopenedState) : null,
    });
    expect(heroReopenedState).toBeTruthy();
    expect(heroReopenedState.actor).toBe(0);
  });
});
