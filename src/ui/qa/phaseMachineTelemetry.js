import fs from "node:fs";
import path from "node:path";

const DEFAULT_DIR = path.resolve("reports/phase-machine");

export function buildPhaseMachineTraceRow(row = {}, assertion = {}) {
  return {
    timestamp: new Date().toISOString(),
    variant: row.variantId ?? null,
    mode: row.mode ?? null,
    phase: row.phase ?? null,
    prevPhase: assertion.previousPhase ?? null,
    drawRound: row.drawRound ?? null,
    betRound: row.betRound ?? null,
    actorSeat: row.controller?.actorSeat ?? null,
    controllerActor: row.controller?.actorSeat ?? null,
    uiActor: row.ui?.actingBadgeSeat ?? null,
    handId: row.handId ?? null,
    transitionType: assertion.transitionType ?? null,
    legal: !(assertion.violations ?? []).some((violation) => violation.severity === "P0"),
    violations: assertion.violations ?? [],
  };
}

export function appendPhaseMachineTrace(fileName, row) {
  fs.mkdirSync(DEFAULT_DIR, { recursive: true });
  const filePath = path.join(DEFAULT_DIR, fileName);
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`);
  return filePath;
}
