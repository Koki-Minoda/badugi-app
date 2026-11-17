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

async function measureGameLayout(page: Page, phase: string) {
  const selectors = ["game-table-surface", "decision-panel", "player-0-card-row",
    phase === "draw" ? "action-draw-selected" : "action-fold"];
  return Promise.all(selectors.map(testId => page.getByTestId(testId).first().boundingBox()));
}

function expectSameLayout(
  normal: Awaited<ReturnType<typeof measureGameLayout>> | undefined,
  practice: Awaited<ReturnType<typeof measureGameLayout>>,
) {
  expect(normal).toBeDefined();
  practice.forEach((box, i) => {
    expect(box).not.toBeNull();
    const expected = normal![i];
    expect(expected).not.toBeNull();
    for (const axis of ["x", "y", "width"] as const) {
      expect(Math.abs(box![axis] - expected![axis]), `element ${i} ${axis}`).toBeLessThan(2);
    }
  });
}

async function playNaturalHandToResult(page: Page, onDecision?: (phase: string) => Promise<void>) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
    if (["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND", "TABLE_FINISHED"].includes(state?.phase)) {
      return;
    }
    if (state?.turn === 0 && state?.phase === "DRAW") {
      await onDecision?.("draw");
      await invoke(page, "forceHeroDraw");
    } else if (state?.turn === 0 && state?.phase === "BET") {
      await onDecision?.("bet");
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

test("a real Badugi hand replays the same actions, chips, pot, and draw cards", async ({ page }, info) => {
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
  const layoutBoxes = new Map<string, Awaited<ReturnType<typeof measureGameLayout>>>();
  await playNaturalHandToResult(page, async (phase) => {
    if (!layoutBoxes.has(phase)) {
      layoutBoxes.set(phase, await measureGameLayout(page, phase));
      await page.screenshot({ path: info.outputPath(`badugi-normal-${phase}.png`) });
    }
  });

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

  const preview = page.getByTestId("badugi-replay-decision-preview");
  await preview.getByRole("button", { name: "最初の判断へ" }).click();
  const cards = record.seats.find((seat: any) => seat.isHero).initialHand;
  await expect(preview.getByText("EV差 — 採点保留")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Analysis" })).toHaveCount(0);
  await preview.getByRole("button", { name: "対局画面で見る" }).click();
  const replayTable = page.getByRole("dialog", { name: "操作前の対局画面" });
  await expect(replayTable.getByTestId("game-table-surface")).toBeVisible();
  await expect(replayTable.getByTestId(/^player-0-card-[0-3]$/)).toHaveCount(cards.length);
  await expect(replayTable.getByTestId("player-action-hint")).toHaveText("あなたの操作前");
  const replayFold = replayTable.getByTestId("action-fold");
  if (await replayFold.count()) await expect(replayFold).toBeDisabled();
  await page.screenshot({ path: info.outputPath("badugi-replay-game-screen.png") });
  const replayMenu = replayTable.getByLabel("対局メニュー");
  if (await replayMenu.isVisible()) await replayMenu.click();
  await replayTable.getByRole("button", { name: "判断の振り返りに戻る" }).click();
  await expect(replayTable).not.toBeVisible();
  const practice = preview.getByRole("link", { name: "この開始手札で練習" });
  const href = await practice.getAttribute("href");
  const practiceUrl = new URL(href!, page.url());
  expect(practiceUrl.searchParams.get("cards")).toBe(cards.join(","));
  expect(practiceUrl.searchParams.get("source")).toBe("replay");
  await page.evaluate(() =>
    localStorage.setItem("mgx.practice.options", JSON.stringify({ cpuDelay: 150, neverFold: true })),
  );
  const regularStats = () => page.evaluate(() => [
    localStorage.getItem("badugi.history.hands"),
    localStorage.getItem("badugi_player_stats_v1"),
  ]);
  const beforePractice = await regularStats();
  await practice.click();
  await expect(page).toHaveURL(/\/learn\/practice\?/);
  const start = page.getByRole("button", { name: "この手札で練習する", exact: true });
  await expect(start).toBeInViewport();
  await start.click();
  const table = page.getByTestId("badugi-practice-game-preview");
  await expect(table.getByTestId("game-table-surface")).toBeVisible();
  const heroCards = table.getByTestId(/^player-0-card-[0-3]$/);
  await expect(heroCards).toHaveCount(4);
  const fold = table.getByTestId("action-fold");
  await expect(fold).toBeEnabled();
  await expect(fold).toBeInViewport();
  expectSameLayout(layoutBoxes.get("bet"), await measureGameLayout(page, "bet"));
  await page.screenshot({ path: info.outputPath("badugi-practice-game-preview.png") });
  const exchange = table.getByTestId("action-draw-selected");
  const enabledDecision = table.locator('[data-testid="action-check"]:enabled, [data-testid="action-call"]:enabled');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await expect(exchange.or(enabledDecision)).toBeEnabled({ timeout: 15_000 });
    if (await exchange.isVisible()) break;
    await enabledDecision.click();
  }
  await expect(exchange).toBeEnabled();
  expectSameLayout(layoutBoxes.get("draw"), await measureGameLayout(page, "draw"));
  const drawCard = table.getByTestId("player-0-card-0");
  const previousCard = (await drawCard.textContent())?.replace(/\s/g, "");
  await drawCard.click();
  await expect(drawCard).toHaveAttribute("aria-pressed", "true");
  await expect(exchange).toContainText(/1枚(?:を)?交換/);
  await expect(exchange).toBeInViewport();
  await page.screenshot({ path: info.outputPath("badugi-practice-draw-preview.png") });
  await exchange.click();
  await expect.poll(async () => (await drawCard.textContent())?.replace(/\s/g, "")).not.toBe(previousCard);
  await expect(fold).toBeEnabled({ timeout: 15_000 });
  await fold.click();
  await expect(table.getByTestId("hand-result-overlay")).toBeVisible({ timeout: 20_000 });
  await table.getByTestId("hand-result-history").click();
  await expect(page.getByRole("heading", { name: "Badugiの練習結果" })).toBeVisible();
  expect(await regularStats()).toEqual(beforePractice);
});
