import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/d01-utg-skip-regression.json");

function activeBetSeat(player: any) {
  return Boolean(
    player &&
      !player.folded &&
      !player.hasFolded &&
      !player.seatOut &&
      !player.isBusted &&
      !player.allIn,
  );
}

function nextSeat(players: any[] = [], startIndex: number) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seat = (startIndex + offset) % players.length;
    if (activeBetSeat(players[seat])) return seat;
  }
  return null;
}

test("D01 opening UTG badge cannot be skipped by MP before action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=D01&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 30000 });

  const row = await page.evaluate(() => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label: "d01-utg-skip" }));
  const progress = await getProgressState(page);
  const players = progress.players ?? [];
  const bbSeat = progress.snapshot?.metadata?.lastBlinds?.bbIndex;
  const expectedOpeningActor =
    typeof bbSeat === "number" ? nextSeat(players, (bbSeat + 1) % players.length) : null;
  const seatLabels: Record<string, string | null> = {};
  for (let seat = 0; seat < players.length; seat += 1) {
    seatLabels[String(seat)] = await page.getByTestId(`seat-${seat}-pos`).textContent().catch(() => null);
  }
  const utgSeat = Number(
    Object.entries(seatLabels).find(([, label]) => String(label ?? "").includes("UTG"))?.[0] ?? NaN,
  );
  const priorAction = players.some((player: any) =>
    Boolean(
      player?.lastAction ||
        player?.lastActionType ||
        player?.hasActedThisRound ||
        player?.actedThisRound ||
        player?.folded ||
        player?.hasFolded,
    ),
  );
  const report = {
    variantId: "D01",
    phase: progress.phase,
    drawRound: progress.drawRoundIndex,
    handId: progress.handId,
    buttonSeat: progress.snapshot?.dealerIndex ?? row?.buttonSeat ?? null,
    sbSeat: progress.snapshot?.metadata?.lastBlinds?.sbIndex ?? row?.sbSeat ?? null,
    bbSeat: bbSeat ?? row?.bbSeat ?? null,
    expectedOpeningActor,
    actualActor: progress.actor,
    row,
    seatLabels,
    utgSeat: Number.isFinite(utgSeat) ? utgSeat : null,
    priorAction,
    classification:
      !priorAction &&
      progress.phase === "BET" &&
      Number(progress.drawRoundIndex ?? 0) === 0 &&
      typeof expectedOpeningActor === "number" &&
      progress.actor !== expectedOpeningActor
        ? "REAL_ACTOR_CORRUPTION"
        : Number.isFinite(utgSeat) && typeof expectedOpeningActor === "number" && utgSeat !== expectedOpeningActor
          ? "POSITION_BADGE_DIVERGENCE"
          : priorAction
            ? "PASS_AFTER_AUTO_PROGRESS"
            : "PASS",
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  expect(report.classification, JSON.stringify(report, null, 2)).not.toBe("REAL_ACTOR_CORRUPTION");
  expect(report.classification, JSON.stringify(report, null, 2)).not.toBe("POSITION_BADGE_DIVERGENCE");
  if (!priorAction && progress.phase === "BET" && Number(progress.drawRoundIndex ?? 0) === 0) {
    expect(progress.actor).toBe(expectedOpeningActor);
    expect(utgSeat).toBe(expectedOpeningActor);
  }
});
