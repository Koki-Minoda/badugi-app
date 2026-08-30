import { expect, test, type Page } from "@playwright/test";

import {
  auditHandReplayFidelity,
  replayHandFromHistory,
} from "../../src/games/badugi/flow/handReplay.js";
import { openAuthenticatedGame } from "./authHelper";

async function invoke(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function playNaturalHandToResult(page: Page) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
    if (["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND", "TABLE_FINISHED"].includes(state?.phase)) {
      return;
    }
    if (state?.turn === 0 && state?.phase === "DRAW") {
      await invoke(page, "forceHeroDraw");
    } else if (state?.turn === 0 && state?.phase === "BET") {
      const players = Array.isArray(state?.players) ? state.players : [];
      const currentBet = players.reduce(
        (max: number, player: any) => Math.max(max, Number(player?.betThisRound) || 0),
        0,
      );
      const heroBet = Number(players[0]?.betThisRound) || 0;
      await invoke(page, "forceSeatAction", 0, { type: currentBet > heroBet ? "call" : "check" });
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Natural hand did not reach a result");
}

test("a real Badugi hand replays the same actions, chips, pot, and draw cards", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => window.localStorage.setItem("mgx.previewVariants", "true"));
  await openAuthenticatedGame(page);
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.dealNewHandNow === "function" &&
      typeof window.__BADUGI_E2E__?.getHandHistory === "function",
    undefined,
    { timeout: 60_000 },
  );

  await invoke(page, "dealNewHandNow");
  const handId = await page.waitForFunction(
    () => {
      const state = window.__BADUGI_E2E__?.getPhaseState?.();
      return state?.handId && state?.phase === "BET" ? state.handId : null;
    },
    undefined,
    { timeout: 30_000 },
  ).then((handle) => handle.jsonValue());
  await playNaturalHandToResult(page);

  const record = await page.evaluate((completedHandId) => {
    const history = window.__BADUGI_E2E__?.getHandHistory?.() ?? [];
    return history.find((entry: any) => entry?.handId === completedHandId) ?? null;
  }, handId);
  const frames = replayHandFromHistory(record);
  const fidelity = auditHandReplayFidelity(record, frames);
  const actionBySeq = new Map(
    (record?.seats ?? []).flatMap((seat: any) =>
      (seat?.actions ?? []).map((action: any) => [action.seq, { ...action, seat: seat.seat }]),
    ),
  );
  const actionMismatches = frames
    .filter((frame: any) => ["BET_ACTION", "DRAW_ACTION"].includes(frame.event?.type))
    .filter((frame: any) => {
      const source: any = actionBySeq.get(frame.event.actionSeq);
      return (
        !source ||
        frame.event.seat !== source.seat ||
        (frame.event.type === "BET_ACTION" &&
          (String(source.type).toLowerCase() !== String(frame.event.action).toLowerCase() ||
            (frame.event.amount ?? 0) !== (source.amount ?? 0)))
      );
    });
  const drawFrames = frames.filter((frame: any) => frame.event?.type === "DRAW_ACTION");
  const audit = {
    handId: record?.handId,
    replaySchemaVersion: record?.replaySchemaVersion,
    frameCount: frames.length,
    actionMismatches,
    drawFrames: drawFrames.map((frame: any) => ({
      seat: frame.event.seat,
      before: frame.event.before,
      after: frame.event.after,
      replayHand: frame.players.find((player: any) => player.seat === frame.event.seat)?.hand,
    })),
    final: frames.at(-1),
  };

  expect(audit.handId).toEqual(expect.any(String));
  expect(audit.replaySchemaVersion, JSON.stringify(record)).toBe(2);
  expect(audit.frameCount).toBeGreaterThan(4);
  expect(fidelity, JSON.stringify(fidelity.issues)).toMatchObject({
    valid: true,
    historySource: "cash",
  });
  expect(audit.actionMismatches).toEqual([]);
  expect(audit.drawFrames.length).toBeGreaterThan(0);
  for (const draw of audit.drawFrames) {
    expect(draw.after).toEqual(expect.any(Array));
    expect(draw.replayHand).toEqual(draw.after);
  }
  expect(audit.final.event.type).toBe("HAND_END");
  expect(
    audit.final.integrity,
    JSON.stringify({
      seats: record.seats.map((seat: any) => ({
        seat: seat.seat,
        startStack: seat.startStack,
        endStack: seat.endStack,
        actions: seat.actions.map((action: any) => ({
          seq: action.seq,
          type: action.type,
          amount: action.amount,
        })),
      })),
      handEnd: audit.final.event,
    }),
  ).toEqual({
    valid: true,
    stackMismatches: [],
    reconciliationMismatches: [],
    remainingPot: 0,
  });

  await page.mouse.move(4, 4);
  await page.keyboard.press("Escape");
  await page.getByTestId("hand-result-history").click();
  await page.getByTestId(`hand-history-row-${audit.handId}`).click();
  await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
  await page.getByTestId("replay-last-frame").click();
  await expect(page.getByText(/Awarded pot:/)).toBeVisible();
});
