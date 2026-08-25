import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { CORE5_VARIANTS } from "./helpers/core5LayoutAuditHelper";
import { openLiveGame } from "./helpers/liveCore5Helper";
import {
  getLegalActions,
  getProgressState,
  performSafeAction,
  progressKey,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import { buildActionOrderAuditEntry } from "../../src/games/_core/audit/actionOrderAuditLog.js";

const REPORT_PATH = path.resolve("reports/alpha/live-core5-action-order-audit.json");

type StreetContext = {
  key: string | null;
  previousActorSeat: number | null;
  actedThisStreet: number[];
  actionSequence: any[];
};

const summaryRows: any[] = [];
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
    (typeof buttonSeat === "number" && players.length > 2 ? (buttonSeat + 1) % players.length : buttonSeat);
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
      preDraw && seat !== sbSeat && seat !== bbSeat && currentBet > 0 && playerBet(player) >= currentBet;
    if (actedByLabel || actedByContribution || player?.folded || player?.hasFolded) return [seat];
    return [];
  });
}

function uniqueSeats(seats: number[]) {
  return [...new Set(seats.filter((seat) => Number.isInteger(seat) && seat >= 0))];
}

function appendUniqueSeat(seats: number[], seat: number) {
  return uniqueSeats([...seats, seat]);
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

async function auditVariant(page: Page, variant: (typeof CORE5_VARIANTS)[number]) {
  await openLiveGame(page, variant);
  await waitForE2EDriver(page);

  const street: StreetContext = {
    key: null,
    previousActorSeat: null,
    actedThisStreet: [],
    actionSequence: [],
  };
  const rows: any[] = [];
  const invalidRows: any[] = [];
  const heroControlRows: any[] = [];

  for (let step = 0; step < variant.maxSteps; step += 1) {
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
      const legalActions = await getLegalActions(page);
      const plannedAction = controllerBetAction(progress);
      const auditEntry = buildActionOrderAuditEntry({
        handId: progress.handId,
        variantId: variant.variant,
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
      if (!auditEntry.isOrderValid) invalidRows.push(auditEntry);
      if (auditEntry.actorSeat !== 0 && legalActions.length > 0) {
        heroControlRows.push({ ...auditEntry, reason: "hero controls visible while canonical actor is not hero" });
      }
    }

    const forced = await performSafeAction(page, { policy: "safe" });
    expect(forced.acted, `live forced action should progress: ${JSON.stringify({ variant, step, phase, progress })}`).toBe(true);
    await waitForProgressChange(page, beforeKey, { timeout: 15000 });
    await waitForActorAdvance(page, progress);
    const afterProgress = await getProgressState(page);
    if (phase === "BET" && typeof progress.actor === "number" && !sameStreetActor(progress, afterProgress)) {
      street.previousActorSeat = progress.actor;
      street.actedThisStreet = appendUniqueSeat(street.actedThisStreet, progress.actor);
    }
  }

  return {
    game: variant.game,
    variantId: variant.variant,
    status: invalidRows.length || heroControlRows.length ? "FAIL" : "PASS",
    actionRows: rows.length,
    invalidRows,
    heroControlRows,
    rows,
  };
}

test.describe("Live Core5 action order audit", () => {
  test.describe.configure({ timeout: 360000 });

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          liveUrl: "https://mgx-poker.com/",
          status: summaryRows.every((row) => row.status === "PASS") ? "PASS" : "FAIL",
          rows: summaryRows.map(({ rows, ...row }) => ({
            ...row,
            expectedActualSamples: rows.slice(0, 8).map((entry: any) => ({
              handId: entry.handId,
              phase: entry.phase,
              drawRound: entry.drawRound,
              actionIndex: entry.actionIndex,
              actorSeat: entry.actorSeat,
              actorPosition: entry.actorPosition,
              expectedActorSeat: entry.expectedActorSeat,
              expectedActorPosition: entry.expectedActorPosition,
              action: entry.action,
              isOrderValid: entry.isOrderValid,
              reason: entry.reason,
            })),
          })),
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const variant of CORE5_VARIANTS) {
    test(`${variant.game} live betting history follows canonical order`, async ({ page }) => {
      const result = await auditVariant(page, variant);
      summaryRows.push(result);
      expect(result.invalidRows, JSON.stringify(result.invalidRows.slice(0, 3), null, 2)).toEqual([]);
      expect(result.heroControlRows, JSON.stringify(result.heroControlRows.slice(0, 3), null, 2)).toEqual([]);
      expect(result.actionRows).toBeGreaterThan(0);
    });
  }
});
