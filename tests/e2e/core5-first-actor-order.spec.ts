import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressState,
  invokeE2E,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/core5-first-actor-order.json");

const CORE5 = [
  { game: "Badugi", variantId: "badugi", title: /Badugi/i, requiresPreview: true },
  { game: "2-7 Triple Draw", variantId: "D01", title: /2-7 Triple Draw/i },
  { game: "A-5 Triple Draw", variantId: "D02", title: /A-5 Triple Draw/i },
  { game: "2-7 Single Draw", variantId: "S01", title: /2-7 Single Draw/i },
  { game: "A-5 Single Draw", variantId: "S02", title: /A-5 Single Draw/i },
] as const;

function isActive(player: any, { allowAllIn = false } = {}) {
  return Boolean(
    player &&
      !player.folded &&
      !player.hasFolded &&
      !player.seatOut &&
      !player.isBusted &&
      (allowAllIn || !player.allIn),
  );
}

function nextActiveSeat(players: any[] = [], startIndex: number, options = {}) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seat = (startIndex + offset) % players.length;
    if (isActive(players[seat], options)) return seat;
  }
  return null;
}

function actedOrFoldedBeforeAssert(players: any[] = []) {
  return players.some((player) =>
    Boolean(
      player?.folded ||
        player?.hasFolded ||
        player?.lastAction ||
        player?.lastActionType ||
        player?.actedThisRound ||
        player?.hasActedThisRound,
    ),
  );
}

async function launch(page: Page, variantId: string, requiresPreview = false) {
  if (requiresPreview) {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.previewVariants", "true");
    });
  }
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
}

async function auditInitialActor(page: Page, variantId: string) {
  const progress = await getProgressState(page);
  const snapshot = progress.snapshot ?? {};
  const metadata = snapshot.metadata ?? {};
  const players = progress.players ?? [];
  const buttonSeat = snapshot.dealerIndex ?? progress.state?.dealerIdx ?? null;
  const inferredSbSeat =
    typeof metadata.lastBlinds?.sbIndex === "number"
      ? metadata.lastBlinds.sbIndex
      : typeof buttonSeat === "number" && players.length > 2
        ? (buttonSeat + 1) % players.length
        : typeof buttonSeat === "number"
          ? buttonSeat
          : null;
  const bbSeat =
    typeof metadata.lastBlinds?.bbIndex === "number"
      ? metadata.lastBlinds.bbIndex
      : typeof buttonSeat === "number" && players.length > 2
        ? (buttonSeat + 2) % players.length
        : typeof buttonSeat === "number" && players.length === 2
          ? (buttonSeat + 1) % players.length
          : null;
  const expectedFirstActor =
    typeof bbSeat === "number" && players.length > 2
      ? nextActiveSeat(players, (bbSeat + 1) % players.length)
      : typeof buttonSeat === "number"
        ? nextActiveSeat(players, buttonSeat)
        : null;
  const acted = actedOrFoldedBeforeAssert(players);
  const preDrawBet =
    progress.phase === "BET" &&
    Number(progress.drawRoundIndex ?? 0) === 0 &&
    typeof expectedFirstActor === "number" &&
    typeof progress.actor === "number" &&
    !acted;
  const exactMatched = Boolean(preDrawBet && progress.actor === expectedFirstActor);
  const bbFirstWithoutPriorAction = Boolean(preDrawBet && progress.actor === bbSeat && expectedFirstActor !== bbSeat);
  return {
    variantId,
    handId: progress.handId,
    phase: progress.phase,
    drawRound: progress.drawRoundIndex,
    buttonSeat,
    sbSeat: inferredSbSeat,
    bbSeat: bbSeat ?? null,
    expectedFirstActor,
    actualFirstActor: progress.actor,
    actedOrFoldedBeforeAssert: acted,
    preDrawBet,
    exactMatched,
    bbFirstWithoutPriorAction,
    classification: exactMatched
      ? "PASS"
      : acted
        ? progress.actor === expectedFirstActor
          ? "PASS_AFTER_PRIOR_ACTION"
          : bbFirstWithoutPriorAction
            ? "ENGINE_ACTOR_BUG"
            : "VISUAL_SEAT_LABEL_CONFUSION"
        : bbFirstWithoutPriorAction
          ? "ENGINE_ACTOR_BUG"
          : "UI_ACTOR_SYNC_BUG",
  };
}

async function actorBadgeSeats(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid^='seat-']")).flatMap((seat) => {
      const id = seat.getAttribute("data-testid") ?? "";
      const match = id.match(/seat-(\d+)/);
      if (!match) return [];
      return /ACTING/i.test(seat.textContent ?? "") ? [Number(match[1])] : [];
    }),
  );
}

test.describe("Core 5 first actor order", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: rows.some((row) => row.classification === "ENGINE_ACTOR_BUG" || row.classification === "UI_ACTOR_SYNC_BUG")
            ? "FAIL"
            : "PASS",
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const entry of CORE5) {
    test(`${entry.game} pre-draw first actor follows blinds/button, not fixed visual seat`, async ({ page }) => {
      await launch(page, entry.variantId, Boolean("requiresPreview" in entry && entry.requiresPreview));
      await expect(page.getByText(entry.title).first()).toBeVisible({ timeout: 20000 });

      const audit = await auditInitialActor(page, entry.variantId);
      const legalActions = await getLegalActions(page);
      const actingBadges = await actorBadgeSeats(page);
      const badgeProgress = await getProgressState(page);
      const visualOppositeSeat = 3;

      rows.push({
        game: entry.game,
        ...audit,
        visualOppositeSeat,
        actingBadges,
        canonicalActorAtBadgeRead: badgeProgress.actor,
        heroControlsVisible: legalActions.length > 0,
      });

      expect(audit.bbFirstWithoutPriorAction, JSON.stringify(audit)).toBe(false);
      if (audit.preDrawBet) {
        expect(audit.actualFirstActor).toBe(audit.expectedFirstActor);
        if (audit.actualFirstActor !== 0) {
          expect(legalActions).toEqual([]);
        }
        if (actingBadges.length) {
          expect(actingBadges).toContain(badgeProgress.actor);
        }
      } else {
        expect(audit.classification).not.toBe("ENGINE_ACTOR_BUG");
        expect(audit.classification).not.toBe("UI_ACTOR_SYNC_BUG");
      }

      if (audit.preDrawBet && typeof audit.expectedFirstActor === "number") {
        await invokeE2E(page, "forceControllerAction", audit.expectedFirstActor, { type: "fold" });
        await page.waitForTimeout(250);
        const afterFold = await getProgressState(page);
        const nextExpected = nextActiveSeat(
          afterFold.players,
          (audit.expectedFirstActor + 1) % afterFold.players.length,
        );
        if (
          afterFold.phase === "BET" &&
          Number(afterFold.drawRoundIndex ?? 0) === 0 &&
          typeof afterFold.actor === "number" &&
          typeof nextExpected === "number"
        ) {
          expect(afterFold.actor).toBe(nextExpected);
        }
      }
    });
  }
});
