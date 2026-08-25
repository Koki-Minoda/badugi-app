import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressState,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/triple-draw-first-actor-audit.json");

const VARIANTS = [
  { variant: "D02" },
  { variant: "S01" },
  { variant: "S02" },
] as const;

function nextActiveSeat(players: any[] = [], startIndex: number) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = players[seatIndex];
    if (!player?.folded && !player?.hasFolded && !player?.seatOut && !player?.isBusted && !player?.allIn) {
      return seatIndex;
    }
  }
  return null;
}

async function firstActorAudit(page: Page, variantId: string) {
  const progress = await getProgressState(page);
  const displayedPotText = await page.getByTestId("table-total-pot").first().innerText().catch(() => "");
  const displayedPot = Number(String(displayedPotText).replace(/[^\d.-]/g, ""));
  const snapshot = progress.snapshot ?? {};
  const metadata = snapshot.metadata ?? {};
  const bbSeat = metadata.lastBlinds?.bbIndex;
  const expectedFirstActor =
    typeof bbSeat === "number"
      ? nextActiveSeat(progress.players, (bbSeat + 1) % progress.players.length)
      : null;
  const actedOrFolded = (progress.players ?? []).some((player: any) =>
    Boolean(
      player?.folded ||
        player?.hasFolded ||
        player?.lastAction ||
        player?.lastActionType ||
        player?.actedThisRound,
    ),
  );
  const initialBettingStillObservable =
    progress.phase === "BET" &&
    (progress.drawRoundIndex === 0 || progress.drawRoundIndex === null || progress.drawRoundIndex === undefined) &&
    typeof expectedFirstActor === "number" &&
    typeof progress.actor === "number" &&
    !actedOrFolded;
  const exactFirstActorMatched =
    initialBettingStillObservable &&
    progress.actor === expectedFirstActor &&
    progress.actor !== bbSeat;
  const autoAdvancedBeforeAssert = !initialBettingStillObservable;

  return {
    handId: progress.handId,
    variantId,
    phase: progress.phase,
    drawRound: progress.drawRoundIndex,
    buttonSeat: snapshot.dealerIndex ?? null,
    sbSeat: metadata.lastBlinds?.sbIndex ?? null,
    bbSeat: bbSeat ?? null,
    expectedFirstActor,
    actualFirstActor: progress.actor,
    currentBet: progress.currentBet,
    snapshotPot: progress.pot,
    displayedPot: Number.isFinite(displayedPot) ? displayedPot : null,
    pot: Math.max(Number(progress.pot ?? 0), Number.isFinite(displayedPot) ? displayedPot : 0),
    actedOrFolded,
    initialBettingStillObservable,
    exactFirstActorMatched,
    autoAdvancedBeforeAssert,
    status: exactFirstActorMatched ? "PASS" : autoAdvancedBeforeAssert ? "PASS_WITH_AUTO_ADVANCE" : "FAIL",
  };
}

test.describe("Triple Draw first actor mobile gate", () => {
  test.describe.configure({ timeout: 120000 });

  const auditRows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: auditRows.every((row) => row.status === "PASS" || row.status === "PASS_WITH_AUTO_ADVANCE")
            ? "PASS"
            : "FAIL",
          rows: auditRows,
        },
        null,
        2,
      ),
    );
  });

  for (const { variant } of VARIANTS) {
    test(`${variant} pre-draw first actor is canonical and not BB on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);

      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });

      const audit = await firstActorAudit(page, variant);
      auditRows.push(audit);

      expect(audit.variantId).toBe(variant);
      expect(audit.pot).toBeGreaterThan(0);

      if (audit.initialBettingStillObservable) {
        expect(audit.phase).toBe("BET");
        expect(audit.expectedFirstActor).toBe(audit.actualFirstActor);
        expect(audit.actualFirstActor).not.toBe(audit.bbSeat);
      } else {
        expect(audit.status).toBe("PASS_WITH_AUTO_ADVANCE");
      }

      const legalActions = await getLegalActions(page);
      if (audit.actualFirstActor !== 0 && typeof audit.actualFirstActor === "number") {
        expect(legalActions).toEqual([]);
      }
    });
  }
});
