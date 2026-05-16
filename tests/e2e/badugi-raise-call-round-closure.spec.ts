import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
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

const REPORT_PATH = path.resolve("reports/alpha/badugi-raise-call-round-closure-audit.json");

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

test.describe("Badugi raise/call round closure", () => {
  test("hero raiser is not selected again after all callers match", async ({ page }) => {
    test.setTimeout(180000);
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=cash`);
    await waitForE2EDriver(page);
    await expect(page.getByText(/Badugi/i).first()).toBeVisible({ timeout: 20000 });

    const auditRows: any[] = [];
    let heroRaiseBefore: any = null;
    let heroRaiseAfter: any = null;

    for (let step = 0; step < 80; step += 1) {
      const progress = await getProgressState(page);
      if (progress?.isTerminal) break;
      const legalActions = await getLegalActions(page);
      const canRaise =
        progress?.phase === "BET" &&
        progress?.actor === 0 &&
        legalActions.some((id: string) => id.includes("raise"));
      if (canRaise) {
        heroRaiseBefore = progress;
        const beforeKey = progressKey(progress);
        await page.getByTestId("action-raise").first().click();
        await waitForProgressChange(page, beforeKey, { timeout: 15000 });
        heroRaiseAfter = await getProgressState(page);
        auditRows.push(
          buildBadugiActionAuditEntry({
            handId: heroRaiseBefore.handId,
            phase: "BET",
            drawRound: Number(heroRaiseBefore.drawRoundIndex ?? 0),
            actorSeat: 0,
            actorName: heroRaiseBefore.players?.[0]?.name ?? "Hero",
            action: "RAISE",
            amount: null,
            before: {
              ...heroRaiseBefore.snapshot,
              players: heroRaiseBefore.players,
              currentBet: heroRaiseBefore.currentBet,
              turn: heroRaiseBefore.actor,
            },
            after: {
              ...(heroRaiseAfter.snapshot ?? {}),
              players: heroRaiseAfter.players,
              currentBet: heroRaiseAfter.currentBet,
              turn: heroRaiseAfter.actor,
              nextTurn: heroRaiseAfter.actor,
            },
          }),
        );
        break;
      }

      const beforeKey = progressKey(progress);
      const acted = await performSafeAction(page, { policy: "safe" });
      expect(acted.acted, `setup action should progress: ${JSON.stringify({ step, progress })}`).toBe(true);
      await waitForProgressChange(page, beforeKey, { timeout: 15000 });
    }

    expect(heroRaiseBefore, "test must reach a hero raise betting decision").toBeTruthy();
    expect(heroRaiseAfter, "hero raise must produce a post-action state").toBeTruthy();
    expect(heroRaiseAfter.phase).toBe("BET");
    expect(heroRaiseAfter.actor).not.toBe(0);

    let closedState: any = null;
    let illegalHeroReAction: any = null;

    for (let step = 0; step < 24; step += 1) {
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

    const finalState = closedState ?? (await getProgressState(page));
    const closeAudit = buildBadugiRoundCloseAudit({
      handId: finalState.handId ?? heroRaiseBefore.handId,
      players: finalState.players ?? [],
      currentBet: finalState.currentBet ?? 0,
      actualTransition: finalState.phase,
    });
    const report = {
      generatedAt: new Date().toISOString(),
      status: illegalHeroReAction ? "FAIL" : "PASS",
      heroRaiseBefore: summarizeProgressState(heroRaiseBefore),
      heroRaiseAfter: summarizeProgressState(heroRaiseAfter),
      finalState: summarizeProgressState(finalState),
      illegalHeroReAction,
      closeAudit,
      auditRows,
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    expect(illegalHeroReAction, JSON.stringify(report, null, 2)).toBeNull();
    expect(sameBettingStreet(heroRaiseBefore, finalState)).toBe(false);
    expect(["DRAW", "SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND"]).toContain(String(finalState.phase));
  });
});
