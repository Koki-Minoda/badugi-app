import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BadugiEngine } from "../src/games/badugi/engine/BadugiEngine.js";

const FIXTURE_PATHS = {
  hand1: path.resolve(process.cwd(), "fixtures/hand_1-1772207081375.json"),
  hand2: path.resolve(process.cwd(), "fixtures/hand_2-1772410654526.json"),
};
const PAID_ACTION_TYPES = new Set(["blind", "ante", "call", "raise", "bet", "all-in"]);

function loadFixture(key) {
  const fixturePath = FIXTURE_PATHS[key];
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function evaluationCount(evaluation) {
  if (typeof evaluation?.count === "number") return evaluation.count;
  if (evaluation?.rankType === "BADUGI") return 4;
  if (evaluation?.rankType === "THREE_CARD") return 3;
  if (evaluation?.rankType === "TWO_CARD") return 2;
  if (evaluation?.rankType === "ONE_CARD") return 1;
  return 0;
}

function getSeatContributions(record) {
  const map = new Map();
  (record?.seats ?? []).forEach((seat) => {
    const total = (seat?.actions ?? []).reduce((sum, action) => {
      const type = String(action?.type ?? "").toLowerCase();
      if (!PAID_ACTION_TYPES.has(type)) return sum;
      return sum + Math.max(0, Number(action?.amount) || 0);
    }, 0);
    map.set(seat?.seat, total);
  });
  return map;
}

function replayFixtureWithEngine(record) {
  const engine = new BadugiEngine();
  const contributions = getSeatContributions(record);
  const players = (record?.seats ?? []).map((seat) => {
    const invested = Math.max(0, contributions.get(seat?.seat) || 0);
    return {
      name: seat?.name ?? `Seat ${seat?.seat}`,
      stack: Math.max(0, Number(seat?.startStack) || 0) - invested,
      totalInvested: invested,
      betThisRound: 0,
      folded: false,
      hasFolded: false,
      seatOut: false,
      allIn: false,
      hand: Array.isArray(seat?.hand) ? [...seat.hand] : [],
    };
  });

  const showdown = engine.resolveShowdown(
    {
      gameId: "badugi",
      engineId: "badugi",
      players,
      pots: [],
      metadata: {},
    },
    { cloneState: true },
  );

  return { showdown, contributions };
}

function runCoreIntegrityAssertions(record) {
  const { showdown, contributions } = replayFixtureWithEngine(record);

  const hasAnyFourCard = (record?.seats ?? []).some(
    (seat) => evaluationCount(seat?.evaluation) === 4,
  );
  expect(hasAnyFourCard).toBe(true);
  const winnerSeats = new Set(
    (showdown?.summary ?? [])
      .flatMap((pot) => pot?.payouts ?? [])
      .map((entry) => entry?.seatIndex)
      .filter((seat) => typeof seat === "number"),
  );
  const seatMap = new Map((record?.seats ?? []).map((seat) => [seat?.seat, seat]));
  winnerSeats.forEach((seatIndex) => {
    const winnerEval = seatMap.get(seatIndex)?.evaluation;
    expect(evaluationCount(winnerEval)).toBe(4);
  });

  const investedTotal = Array.from(contributions.values()).reduce((sum, value) => sum + value, 0);
  const blindFloor =
    Math.max(0, Number(record?.level?.sb) || 0) + Math.max(0, Number(record?.level?.bb) || 0);
  expect(showdown.totalPot).toBe(investedTotal);
  expect(showdown.totalPot).toBeGreaterThan(blindFloor);
  expect(showdown.totalPot).toBeGreaterThan(30);

  const sumStart = (record?.seats ?? []).reduce(
    (sum, seat) => sum + Math.max(0, Number(seat?.startStack) || 0),
    0,
  );
  const sumEnd = (showdown?.state?.players ?? []).reduce(
    (sum, player) => sum + Math.max(0, Number(player?.stack) || 0),
    0,
  );
  expect(sumStart).toBe(sumEnd);

  return { showdown };
}

describe("hand history integrity regression (fixtures)", () => {
  it("fixture hand_1 never awards a 3-card seat over 4-card badugi and keeps pot/chips sane", () => {
    const record = loadFixture("hand1");
    runCoreIntegrityAssertions(record);
  });

  it("fixture hand_2 never awards CPU4 3-card hand over existing 4-card badugi", () => {
    const record = loadFixture("hand2");
    const { showdown } = runCoreIntegrityAssertions(record);
    const winnerSeats = new Set(
      (showdown?.summary ?? [])
        .flatMap((pot) => pot?.payouts ?? [])
        .map((entry) => entry?.seatIndex)
        .filter((seat) => typeof seat === "number"),
    );
    expect(winnerSeats.has(3)).toBe(false);
    expect(winnerSeats.has(2)).toBe(true);
  });
});
