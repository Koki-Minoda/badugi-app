#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { runCore5CpuVsCpuSanity } from "./run-core5-cpu-vs-cpu-sanity.js";
import { TOURNAMENT_PRESETS } from "../src/tournament/structure/tournamentPresets.js";
import { simulateTournamentStructure } from "../src/tournament/structure/validateTournamentStructure.js";

const CORE5 = ["badugi", "D01", "D02", "S01", "S02"];
const NODE_MEASURED_VARIANTS = ["D01", "D02", "S01", "S02"];
const PRESETS = TOURNAMENT_PRESETS;

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function buildLevels(preset, count = 18) {
  const levels = [];
  for (let index = 0; index < count; index += 1) {
    const level = index + 1;
    const bb = Math.max(1, Math.round(preset.startingBb * preset.growth ** index / 5) * 5);
    const sb = Math.max(1, Math.round(bb / 2));
    const ante =
      level < preset.anteStartLevel
        ? 0
        : preset.anteType === "FULL_ANTE"
          ? Math.max(1, Math.round(bb * 0.125))
          : bb;
    levels.push({ level, minute: index * preset.blindIntervalMinutes, sb, bb, ante });
  }
  return levels;
}

function simulateStructure(preset, players = 6) {
  const simulation = simulateTournamentStructure(preset, { players });
  const classifications = [];
  if (preset.target === "store") classifications.push("TURBO_VIABLE");
  if (simulation.pushFoldRatio > 0.65) classifications.push("TOO_PUSH_FOLD");
  if (simulation.meaningfulDecisionsPerTournament >= 80) classifications.push("GOOD_DECISION_DENSITY");
  if (preset.target === "world" && simulation.estimatedDurationMinutes >= 55) classifications.push("WORLD_DURATION_VIABLE");
  return {
    ...simulation,
    preset,
    levels: simulation.blindLevels,
    estimatedFinalTableMinutes: simulation.estimatedDurationMinutes,
    estimatedHeadsUpStartMinute: round(simulation.estimatedDurationMinutes - simulation.estimatedHeadsUpDurationMinutes, 1),
    sub10BbMinute: simulation.firstSub10BbMinute,
    sub5BbMinute: simulation.terminalPressureMinute,
    meaningfulDecisionsPerPlayer: round(simulation.meaningfulDecisionsPerTournament / players, 1),
    classifications,
  };
}

function runCpuAudit(cpuMode, variants, hands) {
  const measuredVariants = variants.filter((variant) => NODE_MEASURED_VARIANTS.includes(variant));
  const { summary } = runCore5CpuVsCpuSanity({
    variants: measuredVariants.join(","),
    variantList: measuredVariants,
    hands,
    seats: 6,
    mode: "tournament",
    cpu: cpuMode,
    outDir: "reports/ai",
  });
  return summary;
}

function classifyCpu(summary, cpuMode) {
  const totals = summary.decisionSummary?.totals ?? {};
  const foldRate = totals.foldRate ?? 0;
  const raiseRate = totals.raiseRate ?? 0;
  const openRate = totals.openRate ?? 0;
  const fallbackRate = totals.fallbackRate ?? 0;
  const classifications = [];
  if (foldRate > 0.75) classifications.push("CPU_TOO_NIT");
  if (raiseRate < 0.025 || openRate < 0.02) classifications.push("CPU_TOO_PASSIVE");
  if (fallbackRate > 0.2) classifications.push("RL_FALLBACK_RISK");
  if (foldRate <= 0.75 && raiseRate >= 0.025 && openRate >= 0.02) classifications.push("CPU_REALISTIC_ENOUGH_FOR_AUDIT");
  if (cpuMode === "rl" && (foldRate > 0.8 || raiseRate < 0.02)) classifications.push("PRO_OVERLAY_NEEDS_TUNING_LATER");
  return {
    cpuMode,
    foldRate: round(foldRate),
    callRate: round(totals.callRate),
    raiseRate: round(raiseRate),
    openRate: round(openRate),
    drawRate: round(totals.drawRate),
    fallbackRate: round(fallbackRate),
    totalDecisions: summary.decisionSummary?.totalDecisions ?? 0,
    legalRaiseSpots: totals.legalRaiseSpots ?? 0,
    raiseAvailableButFolded: totals.legalRaiseFolds ?? 0,
    classifications,
  };
}

function buildMeaningfulDecisionRows(cpuSummaries, structures) {
  return cpuSummaries.map((entry) => {
    const totals = entry.summary.decisionSummary?.totals ?? {};
    const meaningful =
      Number(totals.legalRaiseSpots ?? 0) +
      Number(totals.draws ?? 0) -
      Number(totals.legalRaiseFolds ?? 0);
    const handsCompleted = entry.summary.results.reduce((sum, row) => sum + Number(row.handsCompleted ?? 0), 0);
    return {
      cpuMode: entry.cpuMode,
      variantsMeasured: entry.summary.options.variants,
      handsCompleted,
      meaningfulDecisionOpportunities: meaningful,
      meaningfulPerHand: round(meaningful / Math.max(1, handsCompleted), 2),
      legalRaiseSpots: totals.legalRaiseSpots ?? 0,
      drawDecisions: totals.draws ?? 0,
      classification:
        meaningful / Math.max(1, handsCompleted) < 8
          ? "TOO_SHALLOW"
          : totals.foldRate > 0.75
            ? "TOO_NIT"
            : "GOOD_DECISION_DENSITY",
      structureNotes: structures.map((row) => ({
        preset: row.preset.id,
        meaningfulDecisionsPerTournament: row.meaningfulDecisionsPerTournament,
        huEndlessRisk: row.huEndlessRisk,
      })),
    };
  });
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const variants = argValue("variants", CORE5.join(",")).split(",").filter(Boolean);
  const hands = Number(argValue("hands", "100"));
  const generatedAt = new Date().toISOString();
  const structures = PRESETS.map((preset) => simulateStructure(preset));
  const heuristic = runCpuAudit("heuristic", variants, hands);
  const proOverlay = runCpuAudit("rl", variants, hands);
  const cpuSummaries = [
    { cpuMode: "heuristic", summary: heuristic, classification: classifyCpu(heuristic, "heuristic") },
    { cpuMode: "pro-overlay", summary: proOverlay, classification: classifyCpu(proOverlay, "rl") },
  ];
  const badugiGap = variants.includes("badugi")
    ? {
        variantId: "badugi",
        status: "NOT_NODE_MEASURED",
        reason:
          "The existing Node CPU sanity runner intentionally skips Badugi because the Badugi browser/controller path imports JSX-only UI round-flow modules. Use browser/live telemetry for Badugi tournament AI feedback.",
      }
    : null;

  const structureReport = {
    generatedAt,
    status: structures.some((row) => row.huEndlessRisk === "HIGH") ? "WARN" : "PASS",
    presets: structures,
  };
  const aiReport = {
    generatedAt,
    status: cpuSummaries.some((entry) => entry.classification.classifications.includes("CPU_TOO_NIT")) ? "WARN" : "PASS",
    scope: {
      variantsRequested: variants,
      nodeMeasuredVariants: variants.filter((variant) => NODE_MEASURED_VARIANTS.includes(variant)),
      handsPerVariant: hands,
      badugiGap,
    },
    heuristic,
    proOverlay,
    classifications: cpuSummaries.map(({ cpuMode, classification }) => ({ cpuMode, ...classification })),
  };
  const meaningfulReport = {
    generatedAt,
    status: "WARN",
    definition:
      "Meaningful decision = legal raise/open/call/fold choice with stack pressure or a draw choice before terminal/showdown.",
    rows: buildMeaningfulDecisionRows(cpuSummaries, structures),
    gaps: badugiGap ? [badugiGap] : [],
  };
  const turboReport = {
    generatedAt,
    status: "PASS_WITH_NOTES",
    rows: structures.map((row) => ({
      preset: row.preset.id,
      label: row.preset.label,
      target: row.preset.target,
      startingStackBb: row.preset.initialStackBb,
      blindIntervalMinutes: row.preset.blindIntervalMinutes,
      anteType: row.preset.anteMode,
      estimatedDurationMinutes: row.estimatedDurationMinutes,
      estimatedHeadsUpDurationMinutes: row.estimatedHeadsUpDurationMinutes,
      huEndlessRisk: row.huEndlessRisk,
      meaningfulDecisionsPerTournament: row.meaningfulDecisionsPerTournament,
      classifications: row.classifications,
    })),
  };

  writeJson(path.resolve("reports/tournament/tournament-structure-audit.json"), structureReport);
  writeJson(path.resolve("reports/ai/tournament-ai-feedback-audit.json"), aiReport);
  writeJson(path.resolve("reports/tournament/meaningful-decision-density.json"), meaningfulReport);
  writeJson(path.resolve("reports/tournament/turbo-structure-simulation.json"), turboReport);

  console.log(
    JSON.stringify(
      {
        status: {
          structure: structureReport.status,
          ai: aiReport.status,
          meaningful: meaningfulReport.status,
          turbo: turboReport.status,
        },
        heuristic: aiReport.classifications.find((row) => row.cpuMode === "heuristic"),
        proOverlay: aiReport.classifications.find((row) => row.cpuMode === "pro-overlay"),
        badugiGap,
        reports: [
          "reports/tournament/tournament-structure-audit.json",
          "reports/ai/tournament-ai-feedback-audit.json",
          "reports/tournament/meaningful-decision-density.json",
          "reports/tournament/turbo-structure-simulation.json",
        ],
      },
      null,
      2,
    ),
  );
}

main();
