#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { TOURNAMENT_PRESETS } from "../src/tournament/structure/tournamentPresets.js";
import { runTournamentStructureGate } from "../src/tournament/structure/validateTournamentStructure.js";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeMarkdown(filePath, gate) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [
    "# Tournament Structure Gate",
    "",
    `Generated: ${gate.generatedAt}`,
    "",
    `Status: \`${gate.status}\``,
    "",
    "| Preset | Status | Duration | p95 | HU Risk | Meaningful | Push/Fold | Notes |",
    "| --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
  ];
  for (const row of gate.rows) {
    const sim = row.simulation;
    const notes = [...row.validation.failures, ...row.validation.warnings].join("; ") || "-";
    lines.push(
      `| ${row.preset.label} | ${row.validation.status} | ${sim.estimatedDurationMinutes} | ${sim.p95DurationMinutes} | ${sim.huEndlessRisk} | ${sim.meaningfulDecisionsPerTournament} | ${sim.pushFoldRatio} | ${notes} |`,
    );
  }
  lines.push("");
  lines.push("Regional/National/World must pass. Store Turbo may pass with notes if it remains playable and the blind curve reaches terminal pressure.");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

const gate = runTournamentStructureGate(TOURNAMENT_PRESETS);
const reportPath = "reports/tournament/tournament-structure-gate.json";
const markdownPath = "reports/tournament/tournament-structure-gate.md";
writeJson(reportPath, gate);
writeMarkdown(markdownPath, gate);

console.log(
  JSON.stringify(
    {
      status: gate.status,
      presets: gate.rows.map((row) => ({
        id: row.preset.id,
        status: row.validation.status,
        duration: row.simulation.estimatedDurationMinutes,
        p95: row.simulation.p95DurationMinutes,
        huEndlessRisk: row.simulation.huEndlessRisk,
        meaningfulDecisions: row.simulation.meaningfulDecisionsPerTournament,
        pushFoldRatio: row.simulation.pushFoldRatio,
      })),
      reports: [reportPath, markdownPath],
    },
    null,
    2,
  ),
);

process.exit(gate.status === "FAIL" ? 1 : 0);
