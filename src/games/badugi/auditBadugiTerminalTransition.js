import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTurnState } from "../core/turn/actorEligibility.js";

const PLAYERS = [
  { name: "Hero", stack: 560, hand: ["AS", "2H", "3C", "4D"], totalInvested: 20 },
  { name: "CPU 2", stack: 480, hand: ["KS", "KH", "KC", "KD"], totalInvested: 20 },
  { name: "CPU 3", stack: 480, hand: ["QS", "QH", "QC", "QD"], totalInvested: 20 },
];

function check(name, passed, details = {}) {
  return { name, passed: Boolean(passed), ...details };
}

export function buildBadugiTerminalTransitionAudit() {
  const terminalSnapshot = normalizeTurnState(
    {
      phase: "SHOWDOWN",
      turn: 0,
      nextTurn: 0,
      players: PLAYERS,
      lastHandResult: {
        totalPot: 60,
        results: [{ seatIndex: 0, payout: 60 }],
      },
    },
    { phase: "SHOWDOWN" },
  );
  const resultPot =
    terminalSnapshot.lastHandResult?.totalPot ??
    terminalSnapshot.lastHandResult?.pot ??
    0;
  const nextSnapshot = normalizeTurnState(
    {
      phase: "BET",
      turn: 0,
      nextTurn: 0,
      currentBet: 10,
      players: PLAYERS.map((player, seat) => ({
        ...player,
        stack: 500,
        totalInvested: seat === 1 ? 5 : seat === 2 ? 10 : 0,
        betThisRound: seat === 1 ? 5 : seat === 2 ? 10 : 0,
        hasActedThisRound: false,
      })),
      lastHandResult: null,
    },
    { phase: "BET" },
  );

  const checks = [
    check("terminal phase reached", terminalSnapshot.phase === "SHOWDOWN", {
      phase: terminalSnapshot.phase,
    }),
    check("last hand result present", Boolean(terminalSnapshot.lastHandResult)),
    check("terminal pot awarded", resultPot > 0, { resultPot }),
    check("terminal actor cleared", terminalSnapshot.turn == null && terminalSnapshot.nextTurn == null, {
      turn: terminalSnapshot.turn,
      nextTurn: terminalSnapshot.nextTurn,
    }),
    check(
      "terminal turn flags cleared",
      terminalSnapshot.players.every((player) => player.isTurn === false),
    ),
    check("next hand resets to betting", nextSnapshot.phase === "BET", {
      phase: nextSnapshot.phase,
    }),
    check("next hand has fresh blinds", nextSnapshot.currentBet === 10, {
      currentBet: nextSnapshot.currentBet,
    }),
    check(
      "next hand pot starts from fresh blind commitments",
      nextSnapshot.players.reduce((sum, player) => sum + Number(player.totalInvested ?? 0), 0) === 15,
      {
        invested: nextSnapshot.players.reduce((sum, player) => sum + Number(player.totalInvested ?? 0), 0),
      },
    ),
  ];
  const failed = checks.filter((entry) => !entry.passed);
  return {
    generatedAt: new Date().toISOString(),
    variant: "badugi",
    promoted: false,
    routingChanged: false,
    checks,
    summary: {
      total: checks.length,
      failed: failed.length,
      passed: checks.length - failed.length,
      status: failed.length ? "FAIL" : "PASS",
    },
  };
}

export function writeBadugiTerminalTransitionAudit(
  outputPath = "reports/alpha/badugi-terminal-transition-audit.json",
) {
  const report = buildBadugiTerminalTransitionAudit();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  const report = writeBadugiTerminalTransitionAudit(process.argv[2]);
  console.log(JSON.stringify(report.summary, null, 2));
}
