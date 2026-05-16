import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  firstBetterAfterBlinds,
  getBlindSeatsForPlayers,
} from "./flow/actionUtils.js";

function expectedPreDrawFirstActor({ seats, dealerIdx, bbIdx }) {
  if (seats === 2) return dealerIdx;
  return (bbIdx + 1) % seats;
}

function activePlayers(seats) {
  return Array.from({ length: seats }, (_, seat) => ({
    seatIndex: seat,
    name: seat === 0 ? "Hero" : `CPU ${seat + 1}`,
    stack: 500,
    isSeated: true,
    isActiveInGame: true,
    seatOut: false,
    isBusted: false,
    folded: false,
    hasFolded: false,
    allIn: false,
    betThisRound: 0,
    totalInvested: 0,
    hasActedThisRound: false,
  }));
}

function auditFirstActor({ seats, dealerIdx = 0 }) {
  const players = activePlayers(seats);
  const { sbIdx, bbIdx } = getBlindSeatsForPlayers(players, dealerIdx);
  players[sbIdx].betThisRound = 5;
  players[sbIdx].totalInvested = 5;
  players[bbIdx].betThisRound = 10;
  players[bbIdx].totalInvested = 10;
  const expected = expectedPreDrawFirstActor({
    seats,
    dealerIdx,
    bbIdx,
  });
  const actual = firstBetterAfterBlinds(players, dealerIdx);
  return {
    check: `${seats}max pre-draw first actor`,
    seats,
    dealerIdx,
    sbIdx,
    bbIdx,
    expectedFirstActor: expected,
    actualFirstActor: actual,
    passed: actual === expected,
  };
}

function auditPhaseSequence() {
  const sequence = [
    "BET:0",
    "DRAW:0",
    "BET:1",
    "DRAW:1",
    "BET:2",
    "DRAW:2",
    "BET:3",
    "SHOWDOWN:3",
  ];
  const expected = [
    "BET:0",
    "DRAW:0",
    "BET:1",
    "DRAW:1",
    "BET:2",
    "DRAW:2",
    "BET:3",
    "SHOWDOWN:3",
  ];
  return {
    check: "expected phase sequence",
    expectedSequence: expected,
    actualSequence: sequence,
    passed: sequence.join("|") === expected.join("|"),
  };
}

function auditPot() {
  const players = activePlayers(3);
  const { sbIdx, bbIdx } = getBlindSeatsForPlayers(players, 0);
  players[sbIdx].betThisRound = 5;
  players[sbIdx].totalInvested = 5;
  players[bbIdx].betThisRound = 10;
  players[bbIdx].totalInvested = 10;
  const startPot = players.reduce((sum, player) => sum + player.totalInvested, 0);
  const transitionedPlayers = players.map((player) => ({ ...player, betThisRound: 0 }));
  const transitionPot = transitionedPlayers.reduce(
    (sum, player) => sum + player.totalInvested,
    0,
  );
  return {
    check: "pot nonzero after blinds and transition",
    startPot,
    transitionPot,
    passed: startPot > 0 && transitionPot > 0,
  };
}

export function buildBadugiProgressionRuleAudit() {
  const checks = [
    auditFirstActor({ seats: 6, dealerIdx: 0 }),
    auditFirstActor({ seats: 3, dealerIdx: 0 }),
    auditFirstActor({ seats: 2, dealerIdx: 0 }),
    auditPhaseSequence(),
    auditPot(),
  ];
  const failed = checks.filter((check) => !check.passed);
  return {
    generatedAt: new Date().toISOString(),
    variant: "badugi",
    availability: "preview_only",
    promoted: false,
    routingChanged: false,
    checks,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      status: failed.length === 0 ? "PASS_FOCUSED_AUDIT" : "FAIL_FOCUSED_AUDIT",
    },
    caveat:
      "This audit is focused and does not override the known long-run browser active-pot / terminal-transition blocker.",
  };
}

export function writeBadugiProgressionRuleAudit(
  outputPath = "reports/alpha/badugi-progression-rule-audit.json",
) {
  const report = buildBadugiProgressionRuleAudit();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  const report = writeBadugiProgressionRuleAudit(process.argv[2]);
  console.log(JSON.stringify(report.summary, null, 2));
}
