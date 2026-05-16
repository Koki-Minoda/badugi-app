import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
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
import {
  buildBadugiActionAuditEntry,
  buildBadugiRoundCloseAudit,
  playersNeedingBadugiBetAction,
} from "../../src/games/badugi/auditBadugiActionOrder.js";

const REPORT_PATH = path.resolve("reports/alpha/live-badugi-betting-closure.json");

const rows: any[] = [];

function playerContribution(player: any) {
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

function controllerCallOrCheck(progress: any) {
  const actor = progress?.actor;
  const actorPlayer = typeof actor === "number" ? progress?.players?.[actor] : null;
  const toCall = Math.max(0, Number(progress?.currentBet ?? 0) - playerContribution(actorPlayer));
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

async function forceBetAction(page: any, actor: number, payload: any) {
  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot) {
    snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  }
  return snapshot;
}

async function reachHeroRaise(page: any) {
  await openLiveGame(page, { variant: "badugi" });
  await waitForE2EDriver(page);

  for (let step = 0; step < 100; step += 1) {
    const progress = await getProgressState(page);
    if (progress?.isTerminal) break;
    const legalActions = await getLegalActions(page);
    const canRaise =
      progress?.phase === "BET" &&
      progress?.actor === 0 &&
      legalActions.some((id: string) => id.includes("raise"));
    if (canRaise) {
      const beforeKey = progressKey(progress);
      await page.getByTestId("action-raise").first().click();
      await waitForProgressChange(page, beforeKey, { timeout: 15000 });
      return { before: progress, after: await getProgressState(page) };
    }

    const beforeKey = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(acted.acted, `setup action should progress: ${JSON.stringify({ step, progress })}`).toBe(true);
    await waitForProgressChange(page, beforeKey, { timeout: 15000 });
  }

  throw new Error("Live Badugi did not reach a hero raise decision within the step budget");
}

async function closeRaisedStreetWithoutReraise(page: any, heroRaiseBefore: any) {
  const auditRows: any[] = [];
  let closedState: any = null;
  let illegalHeroReAction: any = null;

  for (let step = 0; step < 30; step += 1) {
    const progress = await getProgressState(page);
    if (!sameBettingStreet(heroRaiseBefore, progress)) {
      closedState = progress;
      break;
    }

    if (progress.actor === 0) {
      illegalHeroReAction = {
        progress: summarizeProgressState(progress),
        legalActions: await getLegalActions(page),
        pendingSeats: playersNeedingBadugiBetAction(progress.players, progress.currentBet),
      };
      break;
    }

    expect(typeof progress.actor).toBe("number");
    const before = progress;
    const beforeKey = progressKey(progress);
    const payload = controllerCallOrCheck(progress);
    const snapshot = await forceBetAction(page, progress.actor, payload);
    expect(snapshot, `non-hero ${payload.type} should apply`).toBeTruthy();
    await waitForProgressChange(page, beforeKey, { timeout: 15000 });
    const after = await getProgressState(page);
    auditRows.push(
      buildBadugiActionAuditEntry({
        handId: before.handId,
        phase: "BET",
        drawRound: Number(before.drawRoundIndex ?? 0),
        actorSeat: before.actor,
        actorName: before.players?.[before.actor]?.name ?? null,
        action: String(payload.type).toUpperCase(),
        amount: payload.amount ?? 0,
        before: {
          ...before.snapshot,
          players: before.players,
          currentBet: before.currentBet,
          turn: before.actor,
        },
        after: {
          ...(snapshot ?? {}),
          players: after.players,
          currentBet: after.currentBet,
          turn: after.actor,
          nextTurn: after.actor,
        },
      }),
    );
  }

  return { closedState: closedState ?? (await getProgressState(page)), illegalHeroReAction, auditRows };
}

test.describe("Live Badugi betting closure", () => {
  test.describe.configure({ timeout: 360000 });

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    writeLiveReport(REPORT_PATH, rows, { liveUrl: "https://mgx-poker.com/" });
    expect(rows.filter((row) => row.status === "FAIL"), JSON.stringify(rows, null, 2)).toEqual([]);
  });

  test("raise/call without re-raise closes the street before hero acts again", async ({ page }) => {
    const heroRaise = await reachHeroRaise(page);
    const closure = await closeRaisedStreetWithoutReraise(page, heroRaise.before);
    const closeAudit = buildBadugiRoundCloseAudit({
      handId: closure.closedState.handId ?? heroRaise.before.handId,
      players: closure.closedState.players ?? [],
      currentBet: closure.closedState.currentBet ?? 0,
      actualTransition: closure.closedState.phase,
    });

    const row = {
      case: "raise-call-no-reraise",
      status: closure.illegalHeroReAction ? "FAIL" : "PASS",
      heroRaiseBefore: summarizeProgressState(heroRaise.before),
      heroRaiseAfter: summarizeProgressState(heroRaise.after),
      finalState: summarizeProgressState(closure.closedState),
      illegalHeroReAction: closure.illegalHeroReAction,
      closeAudit,
      auditRows: closure.auditRows,
    };
    rows.push(row);

    expect(closure.illegalHeroReAction, JSON.stringify(row, null, 2)).toBeNull();
    expect(sameBettingStreet(heroRaise.before, closure.closedState), JSON.stringify(row, null, 2)).toBe(false);
  });

  test("another player re-raise is the only live path that can reopen hero action", async ({ page }) => {
    const heroRaise = await reachHeroRaise(page);
    const firstOpponent = await getProgressState(page);
    expect(firstOpponent.phase).toBe("BET");
    expect(firstOpponent.actor).not.toBe(0);
    expect(typeof firstOpponent.actor).toBe("number");

    const beforeKey = progressKey(firstOpponent);
    const reraiseSnapshot = await forceBetAction(page, firstOpponent.actor, { type: "raise" });
    expect(reraiseSnapshot, "opponent re-raise should apply").toBeTruthy();
    await waitForProgressChange(page, beforeKey, { timeout: 15000 });

    let heroReopenedState: any = null;
    const auditRows: any[] = [];
    for (let step = 0; step < 30; step += 1) {
      const progress = await getProgressState(page);
      if (!sameBettingStreet(heroRaise.before, progress)) break;
      if (progress.actor === 0) {
        heroReopenedState = progress;
        break;
      }
      expect(typeof progress.actor).toBe("number");
      const before = progress;
      const stepKey = progressKey(progress);
      const payload = controllerCallOrCheck(progress);
      const snapshot = await forceBetAction(page, progress.actor, payload);
      expect(snapshot, `non-hero ${payload.type} should apply while waiting for reopened hero action`).toBeTruthy();
      await waitForProgressChange(page, stepKey, { timeout: 15000 });
      const after = await getProgressState(page);
      auditRows.push({ before: summarizeProgressState(before), after: summarizeProgressState(after), payload });
    }

    const row = {
      case: "reraise-reopens-hero",
      status: heroReopenedState ? "PASS" : "FAIL",
      heroRaiseBefore: summarizeProgressState(heroRaise.before),
      firstOpponentBeforeReraise: summarizeProgressState(firstOpponent),
      heroReopenedState: heroReopenedState ? summarizeProgressState(heroReopenedState) : null,
      auditRows,
    };
    rows.push(row);

    expect(heroReopenedState, JSON.stringify(row, null, 2)).toBeTruthy();
    expect(heroReopenedState.actor).toBe(0);
    expect(await getLegalActions(page)).not.toEqual([]);
  });
});
