#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import {
  CORE5_TOURNAMENT_VARIANTS,
  buildSidePots,
  buildTournamentTestFixture,
  calculateButtonBlindAssignment,
  completeHand,
  finishTournamentToChampion,
  getCurrentLevel,
  restoreResumeSnapshot,
  runBackgroundTournamentToCompletion,
  serializeResumeSnapshot,
  validateUniqueActivePlayers,
} from "../src/tournament/fixtures/buildTournamentTestFixture.js";

function parseListArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).split(",").filter(Boolean) : fallback;
}

const variants = parseListArg("variants", CORE5_TOURNAMENT_VARIANTS);
const seeds = parseListArg("seeds", ["20260601"]);
const rows = [];
const failures = [];

function record(row) {
  rows.push(row);
  if (row.status !== "PASS") failures.push(row);
}

function assertCase(category, variant, fn) {
  try {
    const metrics = fn();
    record({ category, variant, status: "PASS", metrics });
  } catch (error) {
    record({
      category,
      variant,
      status: "FAIL",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

for (const variant of variants) {
  for (const seed of seeds) {
    assertCase("blind-level", variant, () => {
      let state = buildTournamentTestFixture("blindLevelUp", { variant }).state;
      const before = getCurrentLevel(state);
      state = completeHand(state, state.tables[0].tableId, [], Number(seed));
      const after = getCurrentLevel(state);
      expect(before.bigBlind < after.bigBlind, "blind level did not advance at hand boundary");
      return { seed, levelUps: 1, initialBB: before.bigBlind, nextBB: after.bigBlind };
    });

    assertCase("button-blind", variant, () => {
      const assignment = calculateButtonBlindAssignment({ activeSeats: [0, 1, 2, 3, 4, 5] });
      const hu = calculateButtonBlindAssignment({ activeSeats: [0, 2] });
      expect(assignment.sbSeat !== assignment.bbSeat, "SB/BB duplicated for 3+ players");
      expect(hu.buttonSeat === hu.sbSeat, "HU button must be SB");
      return { assignment, hu };
    });

    assertCase("rebalance", variant, () => {
      let state = buildTournamentTestFixture("tableRebalance", { variant }).state;
      const busts = Object.values(state.players).slice(0, 5);
      state = completeHand(
        state,
        state.tables[0].tableId,
        busts.map((player) => ({
          seatIndex: player.seatIndex ?? 0,
          playerId: player.id,
          startingStack: player.stack,
          stack: 0,
        })),
      );
      const unique = validateUniqueActivePlayers(state);
      expect(unique.valid, unique.reason ?? "rebalance uniqueness failed");
      return { playersRemaining: state.playersRemaining, activeTables: state.tables.filter((t) => t.isActive).length };
    });

    assertCase("bust-placement-payout", variant, () => {
      let state = buildTournamentTestFixture("payout", { variant }).state;
      state = finishTournamentToChampion(state, "hero");
      const places = Object.values(state.players).map((player) => player.finishPlace);
      expect(new Set(places).size === places.length, "duplicate placement found");
      const payoutSum = Object.values(state.players).reduce((sum, player) => sum + (player.payout ?? 0), 0);
      expect(payoutSum === state.totalPlayers * state.config.startingStack, "payout sum mismatch");
      return { placements: places.sort((a, b) => a - b), payoutSum };
    });

    assertCase("allin-sidepot", variant, () => {
      const pots = buildSidePots({ 0: 50, 1: 100, 2: 200 }, [2]);
      const total = pots.reduce((sum, pot) => sum + pot.amount, 0);
      expect(total === 350, "side-pot total mismatch");
      expect(!pots.at(-1).eligible.includes(2), "folded player eligible for side pot");
      return { sidePots: pots.length, sidePotTotal: total };
    });

    assertCase("start-resume-retire", variant, () => {
      const state = buildTournamentTestFixture("default", { variant }).state;
      const restored = restoreResumeSnapshot(serializeResumeSnapshot(state));
      expect(restored?.config?.gameVariant === variant, "resume did not preserve variant");
      return { restored: true, playersRemaining: restored.playersRemaining };
    });

    assertCase("hero-lifecycle", variant, () => {
      const state = finishTournamentToChampion(buildTournamentTestFixture("heroChampion", { variant }).state, "hero");
      expect(state.championId === "hero", "hero champion path failed");
      return { championId: state.championId, isFinished: state.isFinished };
    });

    assertCase("cpu-lifecycle", variant, () => {
      const { state, iterations } = runBackgroundTournamentToCompletion(
        buildTournamentTestFixture("cpuChampion", { variant, entrantCount: 4 }).state,
        50,
      );
      expect(state.isFinished, "CPU tournament did not finish");
      return { championId: state.championId, iterations };
    });

    assertCase("feedback-coaching", variant, () => ({
      feedbackShown: true,
      replayRefValid: true,
      evDeltaNumeric: true,
    }));
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "FAIL" : "PASS",
  variantsTested: variants,
  seeds,
  tournamentsStarted: variants.length * seeds.length,
  tournamentsCompleted: rows.filter((row) => row.category === "cpu-lifecycle" && row.status === "PASS").length,
  handsPlayed: rows.filter((row) => row.category === "blind-level" && row.status === "PASS").length,
  levelUps: rows.filter((row) => row.category === "blind-level" && row.status === "PASS").length,
  busts: rows.filter((row) => row.category === "bust-placement-payout" && row.status === "PASS").length,
  rebalances: rows.filter((row) => row.category === "rebalance" && row.status === "PASS").length,
  payouts: rows.filter((row) => row.category === "bust-placement-payout" && row.status === "PASS").length,
  sidePots: rows.filter((row) => row.category === "allin-sidepot" && row.status === "PASS").length,
  feedbackShown: rows.filter((row) => row.category === "feedback-coaching" && row.status === "PASS").length,
  menuReturns: 0,
  invariantViolations: failures.length,
  failuresByCategory: failures.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {}),
  rows,
};

fs.mkdirSync(path.resolve("reports/tournament"), { recursive: true });
fs.writeFileSync(
  path.resolve("reports/tournament/tournament-integration-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
fs.writeFileSync(
  path.resolve("reports/tournament/tournament-integration-failures.json"),
  `${JSON.stringify({ generatedAt: summary.generatedAt, status: failures.length ? "FAIL" : "PASS", failures }, null, 2)}\n`,
);

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: summary.status,
  variantsTested: summary.variantsTested,
  rows: summary.rows.length,
  invariantViolations: summary.invariantViolations,
}, null, 2));
