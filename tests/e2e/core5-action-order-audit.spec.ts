import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressState,
  performSafeAction,
  progressKey,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import {
  buildActionOrderAuditEntry,
  formatOrderAuditLine,
} from "../../src/games/_core/audit/actionOrderAuditLog.js";

const JSONL_PATH = path.resolve("reports/alpha/core5-action-order-audit.jsonl");
const SUMMARY_PATH = path.resolve("reports/alpha/core5-action-order-audit-summary.json");
const USER_CASE_PATH = path.resolve("reports/alpha/user-reported-bb-order-case.json");

const CORE5 = [
  { game: "Badugi", variantId: "badugi", title: /Badugi/i },
  { game: "2-7 Triple Draw", variantId: "D01", title: /2-7 Triple Draw/i },
  { game: "A-5 Triple Draw", variantId: "D02", title: /A-5 Triple Draw/i },
  { game: "2-7 Single Draw", variantId: "S01", title: /2-7 Single Draw/i },
  { game: "A-5 Single Draw", variantId: "S02", title: /A-5 Single Draw/i },
] as const;

type StreetContext = {
  key: string | null;
  previousActorSeat: number | null;
  actedThisStreet: number[];
  actionSequence: any[];
};

const summaryRows: any[] = [];
const userReportedCaseRows: any[] = [];
const BETTING_ACTION_LABELS = new Set([
  "CHECK",
  "CALL",
  "BET",
  "RAISE",
  "FOLD",
  "ALL-IN",
  "CALL (ALL-IN)",
  "RAISE (ALL-IN)",
]);

function safeNumber(value: any) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractBlindContext(progress: any) {
  const snapshot = progress?.snapshot ?? {};
  const metadata = snapshot?.metadata ?? {};
  const players = progress?.players ?? [];
  const buttonSeat = safeNumber(snapshot?.dealerIndex ?? progress?.state?.dealerIdx);
  const sbSeat =
    safeNumber(metadata?.lastBlinds?.sbIndex) ??
    (typeof buttonSeat === "number" && players.length > 2
      ? (buttonSeat + 1) % players.length
      : buttonSeat);
  const bbSeat =
    safeNumber(metadata?.lastBlinds?.bbIndex) ??
    (typeof buttonSeat === "number" && players.length > 2
      ? (buttonSeat + 2) % players.length
      : typeof buttonSeat === "number" && players.length === 2
        ? (buttonSeat + 1) % players.length
        : null);
  return { buttonSeat, sbSeat, bbSeat };
}

function streetKey(progress: any) {
  return `${progress?.handId ?? "unknown"}:${progress?.phase ?? "unknown"}:${Number(progress?.drawRoundIndex ?? 0)}`;
}

function sameStreetActor(left: any, right: any) {
  return (
    left?.handId === right?.handId &&
    String(left?.phase ?? "") === String(right?.phase ?? "") &&
    Number(left?.drawRoundIndex ?? 0) === Number(right?.drawRoundIndex ?? 0) &&
    left?.actor === right?.actor
  );
}

function playerBet(player: any) {
  return Math.max(0, Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0);
}

function effectiveCurrentBet(progress: any) {
  return Math.max(
    Number(progress?.currentBet ?? 0) || 0,
    ...(progress?.players ?? []).map((player: any) => playerBet(player)),
  );
}

function inferAlreadyActedThisStreet(progress: any, { sbSeat, bbSeat }: { sbSeat: number | null; bbSeat: number | null }) {
  const currentBet = effectiveCurrentBet(progress);
  const preDraw = String(progress?.phase ?? "") === "BET" && Number(progress?.drawRoundIndex ?? 0) <= 0;
  if (!preDraw) return [];
  return (progress?.players ?? []).flatMap((player: any, seat: number) => {
    const label = String(player?.lastAction ?? "").trim().toUpperCase();
    const blindOnly = preDraw && (seat === sbSeat || seat === bbSeat) && (label === "SB" || label === "BB");
    const actedByLabel = BETTING_ACTION_LABELS.has(label) && !blindOnly;
    const actedByContribution =
      preDraw &&
      seat !== sbSeat &&
      seat !== bbSeat &&
      currentBet > 0 &&
      playerBet(player) >= currentBet;
    if (actedByLabel || actedByContribution || player?.folded || player?.hasFolded) {
      return [seat];
    }
    return [];
  });
}

async function waitForActorAdvance(page: Page, beforeProgress: any, timeout = 5000) {
  await page
    .waitForFunction(
      (before) => {
        const api = window.__BADUGI_E2E__;
        const state = api?.getStateSnapshot?.() ?? null;
        const phaseState = api?.getPhaseState?.() ?? null;
        const snapshot = state?.controllerSnapshot ?? null;
        const phase = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase ?? null;
        const actor =
          typeof phaseState?.turn === "number"
            ? phaseState.turn
            : typeof snapshot?.currentActor === "number"
              ? snapshot.currentActor
              : typeof snapshot?.turn === "number"
                ? snapshot.turn
                : typeof state?.turn === "number"
                  ? state.turn
                  : null;
        const handId = phaseState?.handId ?? state?.handId ?? null;
        const drawRoundIndex =
          snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? phaseState?.drawRound ?? state?.drawRound ?? null;
        const terminal = Boolean(
          ["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].includes(String(phase)) ||
            snapshot?.lastHandResult ||
            state?.lastHandResult,
        );
        return (
          terminal ||
          handId !== before.handId ||
          String(phase ?? "") !== String(before.phase ?? "") ||
          Number(drawRoundIndex ?? 0) !== Number(before.drawRoundIndex ?? 0) ||
          actor !== before.actor
        );
      },
      {
        handId: beforeProgress?.handId,
        phase: beforeProgress?.phase,
        drawRoundIndex: beforeProgress?.drawRoundIndex,
        actor: beforeProgress?.actor,
      },
      { timeout },
    )
    .catch(() => {});
}

function uniqueSeats(seats: number[]) {
  return [...new Set(seats.filter((seat) => Number.isInteger(seat) && seat >= 0))];
}

function appendUniqueSeat(seats: number[], seat: number) {
  return uniqueSeats([...seats, seat]);
}

function playerHasCompletedBetAction(progress: any, seat: number, { sbSeat, bbSeat }: { sbSeat: number | null; bbSeat: number | null }) {
  const player = progress?.players?.[seat];
  if (!player) return false;
  if (player?.folded || player?.hasFolded || player?.allIn || player?.seatOut || player?.isBusted) return true;
  const currentBet = effectiveCurrentBet(progress);
  if (currentBet <= 0) return false;
  const preDraw = String(progress?.phase ?? "") === "BET" && Number(progress?.drawRoundIndex ?? 0) <= 0;
  const blindOnly = preDraw && (seat === sbSeat || seat === bbSeat);
  if (blindOnly) return false;
  return playerBet(player) >= currentBet;
}

function reconcileObservedAutoActions(
  progress: any,
  street: StreetContext,
  { sbSeat, bbSeat }: { sbSeat: number | null; bbSeat: number | null },
) {
  const actor = progress?.actor;
  const players = progress?.players ?? [];
  if (typeof actor !== "number" || !players.length || typeof street.previousActorSeat !== "number") return;

  let cursor = street.previousActorSeat;
  for (let guard = 0; guard < players.length; guard += 1) {
    cursor = (cursor + 1) % players.length;
    if (cursor === actor) return;
    if (street.actedThisStreet.includes(cursor)) continue;
    if (!playerHasCompletedBetAction(progress, cursor, { sbSeat, bbSeat })) return;
    street.actedThisStreet = appendUniqueSeat(street.actedThisStreet, cursor);
    street.previousActorSeat = cursor;
  }
}

function normalizeActionId(actionId: string | null) {
  if (!actionId) return null;
  return actionId.replace(/^action-/, "").replace(/-selected$/, "").toUpperCase();
}

function controllerBetAction(progress: any) {
  const actor = progress?.actor;
  const player = typeof actor === "number" ? progress?.players?.[actor] : null;
  const actorBet = playerBet(player);
  const toCall = Math.max(0, effectiveCurrentBet(progress) - actorBet);
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

function hasInvalidActor(progress: any) {
  if (progress?.isTerminal || typeof progress?.actor !== "number") return false;
  const actor = progress.players?.[progress.actor];
  if (!actor) return true;
  if (actor?.folded || actor?.hasFolded || actor?.seatOut || actor?.isBusted) return true;
  return String(progress.phase) === "BET" && Boolean(actor?.allIn);
}

async function launch(page: Page, variantId: string) {
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
}

async function auditVariant(page: Page, entry: (typeof CORE5)[number]) {
  await launch(page, entry.variantId);
  await expect(page.getByText(entry.title).first()).toBeVisible({ timeout: 20000 });

  const street: StreetContext = {
    key: null,
    previousActorSeat: null,
    actedThisStreet: [],
    actionSequence: [],
  };
  const rows: any[] = [];
  const invalidRows: any[] = [];
  const heroControlRows: any[] = [];

  for (let step = 0; step < 120; step += 1) {
    let progress = await getProgressState(page);
    if (hasInvalidActor(progress)) {
      await waitForProgressChange(page, progressKey(progress), { timeout: 2500 }).catch(() => {});
      progress = await getProgressState(page);
    }
    if (progress?.isTerminal) break;
    const phase = String(progress?.phase ?? "");
    const beforeKey = progressKey(progress);

    if (phase === "BET") {
      const key = streetKey(progress);
      const { buttonSeat, sbSeat, bbSeat } = extractBlindContext(progress);
      if (street.key !== key) {
        street.key = key;
        street.actedThisStreet = uniqueSeats(inferAlreadyActedThisStreet(progress, { sbSeat, bbSeat }));
        street.previousActorSeat =
          street.actedThisStreet.length > 0 ? street.actedThisStreet[street.actedThisStreet.length - 1] : null;
        street.actionSequence = [];
      }
      reconcileObservedAutoActions(progress, street, { sbSeat, bbSeat });

      const legalActions = await getLegalActions(page);
      const plannedAction = controllerBetAction(progress);
      const auditEntry = buildActionOrderAuditEntry({
        handId: progress.handId,
        variantId: entry.variantId,
        phase,
        drawRound: Number(progress.drawRoundIndex ?? 0),
        betRound: progress?.state?.betRound ?? null,
        actionIndex: rows.length,
        buttonSeat,
        sbSeat,
        bbSeat,
        actorSeat: progress.actor,
        previousActorSeat: street.previousActorSeat,
        players: progress.players,
        currentBet: effectiveCurrentBet(progress),
        action: plannedAction.type.toUpperCase(),
        legalActions: legalActions.map(normalizeActionId).filter(Boolean),
        actedThisStreet: street.actedThisStreet,
      });
      rows.push(auditEntry);
      street.actionSequence.push(auditEntry);
      console.log(formatOrderAuditLine(auditEntry));

      if (!auditEntry.isOrderValid) invalidRows.push(auditEntry);
      if (auditEntry.actorSeat !== 0 && legalActions.length > 0) {
        heroControlRows.push({
          ...auditEntry,
          reason: "hero controls visible while canonical actor is not hero",
        });
      }
      if (auditEntry.actorPosition === "BB") {
        userReportedCaseRows.push({
          variantId: entry.variantId,
          matchedUserScreenshotShape:
            auditEntry.phase === "BET" &&
            Number(auditEntry.drawRound) === 2 &&
            Number(auditEntry.currentBet) === 20 &&
            Number(auditEntry.toCall) === 20,
          classification: auditEntry.isOrderValid ? "FALSE_ALARM_CONFIRMED_BY_HISTORY" : "ENGINE_ORDER_BUG",
          bbAction: auditEntry,
          precedingStreetActions: street.actionSequence.slice(0, -1),
        });
      }
    }

    const forced = await performSafeAction(page, { policy: "safe" });
    expect(forced.acted, `forced action should progress: ${JSON.stringify({ entry, step, phase, progress })}`).toBe(true);

    await waitForProgressChange(page, beforeKey, { timeout: 15000 });
    await waitForActorAdvance(page, progress);
    const afterProgress = await getProgressState(page);

    if (phase === "BET" && typeof progress.actor === "number" && !sameStreetActor(progress, afterProgress)) {
      street.previousActorSeat = progress.actor;
      street.actedThisStreet = appendUniqueSeat(street.actedThisStreet, progress.actor);
    }
  }

  return {
    game: entry.game,
    variantId: entry.variantId,
    status: invalidRows.length || heroControlRows.length ? "FAIL" : "PASS",
    actionRows: rows.length,
    invalidRows,
    heroControlRows,
    rows,
  };
}

test.describe("Core 5 betting action order audit", () => {
  test.describe.configure({ timeout: 240000 });

  test.beforeAll(() => {
    fs.mkdirSync(path.dirname(JSONL_PATH), { recursive: true });
    fs.writeFileSync(JSONL_PATH, "");
  });

  test.afterAll(() => {
    const status = summaryRows.every((row) => row.status === "PASS") ? "PASS" : "FAIL";
    fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
    fs.writeFileSync(
      SUMMARY_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status,
          rows: summaryRows.map(({ rows, ...row }) => row),
        },
        null,
        2,
      )}\n`,
    );
    fs.writeFileSync(
      USER_CASE_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: userReportedCaseRows.some((row) => row.classification === "ENGINE_ORDER_BUG")
            ? "FAIL"
            : "PASS",
          note:
            "Rows classify every observed BB betting action by canonical history; exact user screenshot shape may be false if drawRound/currentBet/toCall did not match.",
          rows: userReportedCaseRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const entry of CORE5) {
    test(`${entry.game} action history follows canonical betting order`, async ({ page }) => {
      const result = await auditVariant(page, entry);
      summaryRows.push(result);
      fs.appendFileSync(JSONL_PATH, result.rows.map((row) => JSON.stringify(row)).join("\n") + "\n");

      expect(result.invalidRows, JSON.stringify(result.invalidRows.slice(0, 3), null, 2)).toEqual([]);
      expect(result.heroControlRows, JSON.stringify(result.heroControlRows.slice(0, 3), null, 2)).toEqual([]);
      expect(result.actionRows).toBeGreaterThan(0);
    });
  }
});
