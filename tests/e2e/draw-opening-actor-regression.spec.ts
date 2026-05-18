import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/draw-opening-actor-regression.json");

const VARIANTS = [
  { variantId: "D01", label: "2-7 Triple Draw" },
  { variantId: "D02", label: "A-5 Triple Draw" },
  { variantId: "S01", label: "2-7 Single Draw" },
  { variantId: "S02", label: "A-5 Single Draw" },
] as const;

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

function hasPriorAction(players: any[] = []) {
  return players.some((player) =>
    Boolean(
      player?.lastAction ||
        player?.lastActionType ||
        player?.hasActedThisRound ||
        player?.actedThisRound ||
        player?.folded ||
        player?.hasFolded,
    ),
  );
}

async function readSeatLabels(page: Page, seats: number) {
  const entries: Record<string, string | null> = {};
  for (let seat = 0; seat < seats; seat += 1) {
    entries[String(seat)] = await page.getByTestId(`seat-${seat}-pos`).textContent().catch(() => null);
  }
  return entries;
}

async function auditOpeningActor(page: Page, variantId: string) {
  const progress = await getProgressState(page);
  const snapshot = progress.snapshot ?? {};
  const players = progress.players ?? [];
  const bbSeat = snapshot.metadata?.lastBlinds?.bbIndex;
  const expectedOpeningActor =
    typeof bbSeat === "number" ? nextSeat(players, (bbSeat + 1) % players.length) : null;
  const priorAction = hasPriorAction(players);
  const seatLabels = await readSeatLabels(page, players.length);
  const utgSeat = Object.entries(seatLabels).find(([, label]) => String(label ?? "").includes("UTG"))?.[0];
  const initialOpeningStillVisible =
    progress.phase === "BET" &&
    Number(progress.drawRoundIndex ?? 0) === 0 &&
    typeof progress.actor === "number" &&
    typeof expectedOpeningActor === "number" &&
    !priorAction;
  const exactActorMatch = Boolean(initialOpeningStillVisible && progress.actor === expectedOpeningActor);
  const utgBadgeMatchesActor = typeof utgSeat === "string" ? Number(utgSeat) === expectedOpeningActor : true;

  return {
    variantId,
    handId: progress.handId,
    phase: progress.phase,
    drawRound: progress.drawRoundIndex,
    buttonSeat: snapshot.dealerIndex ?? null,
    sbSeat: snapshot.metadata?.lastBlinds?.sbIndex ?? null,
    bbSeat: bbSeat ?? null,
    expectedOpeningActor,
    actualActor: progress.actor,
    priorAction,
    initialOpeningStillVisible,
    exactActorMatch,
    seatLabels,
    utgSeat: typeof utgSeat === "string" ? Number(utgSeat) : null,
    utgBadgeMatchesActor,
    classification: exactActorMatch && utgBadgeMatchesActor
      ? "PASS"
      : priorAction
        ? "PASS_AFTER_AUTO_PROGRESS"
        : !utgBadgeMatchesActor
          ? "POSITION_BADGE_DIVERGENCE"
          : "REAL_ACTOR_CORRUPTION",
  };
}

test.describe("Draw lowball opening actor regression", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: rows.some((row) =>
            ["REAL_ACTOR_CORRUPTION", "POSITION_BADGE_DIVERGENCE"].includes(row.classification),
          )
            ? "FAIL"
            : "PASS",
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const entry of VARIANTS) {
    test(`${entry.label} opening actor and UTG badge use the same source`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${entry.variantId}`);
      await waitForE2EDriver(page);
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 30000 });

      const audit = await auditOpeningActor(page, entry.variantId);
      rows.push(audit);

      expect(audit.variantId).toBe(entry.variantId);
      expect(audit.classification, JSON.stringify(audit, null, 2)).not.toBe("REAL_ACTOR_CORRUPTION");
      expect(audit.classification, JSON.stringify(audit, null, 2)).not.toBe("POSITION_BADGE_DIVERGENCE");
      if (audit.initialOpeningStillVisible) {
        expect(audit.actualActor).toBe(audit.expectedOpeningActor);
        expect(audit.utgBadgeMatchesActor).toBe(true);
      }
    });
  }
});
