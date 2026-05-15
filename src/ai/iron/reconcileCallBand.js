import fs from "node:fs/promises";
import path from "node:path";

import { extractToCall, normalizeToCallBand } from "../evaluation/discoverStableNeighborBuckets.js";

export const DEFAULT_STEP19_CALL_BAND_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-call-band-reconciliation-step19.json",
);

export function replayCompatibleCallBand({
  toCall = 0,
  pot = 0,
  stack = 0,
  limitUnit = 20,
  street = 0,
  variantId = "",
} = {}) {
  const numericToCall = Math.max(0, Number(toCall ?? 0));
  const standardBand = normalizeToCallBand(numericToCall);
  const normalizedVariant = String(variantId ?? "").toUpperCase();
  const fixedUnit = Math.max(1, Number(limitUnit ?? 20) || 20);
  const normalizedStreet = Number(street ?? 0) || 0;
  const potRatio = pot > 0 ? numericToCall / Number(pot) : 0;
  const stackRatio = stack > 0 ? numericToCall / Number(stack) : 0;

  if (
    normalizedVariant === "S02" &&
    standardBand === "tiny" &&
    numericToCall > 0 &&
    numericToCall <= fixedUnit &&
    normalizedStreet <= 1 &&
    potRatio <= 0.35 &&
    stackRatio <= 0.12
  ) {
    return "small";
  }

  return standardBand;
}

function summarizeCounts(values = []) {
  const counts = {};
  for (const value of values) {
    const key = String(value ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function deriveCorpusCallBand(sample = {}) {
  const snapshot = sample?.state?.snapshot ?? sample?.snapshot ?? {};
  const actorSeat = Number(sample?.actorSeat ?? 0);
  const toCall = extractToCall(sample?.legalActions ?? [], snapshot, actorSeat);
  const player = snapshot?.players?.[actorSeat] ?? {};
  return {
    toCall,
    standard: normalizeToCallBand(toCall),
    reconciled: replayCompatibleCallBand({
      toCall,
      pot: Number(sample?.potSize ?? snapshot?.pot ?? 0) || 0,
      stack: Number(player?.stack ?? 0) || 0,
      limitUnit: Number(snapshot?.bigBlind ?? 20) || 20,
      street: Number(sample?.drawRound ?? snapshot?.drawRound ?? 0) || 0,
      variantId: sample?.variantId,
    }),
  };
}

export async function auditS02CallBandReconciliation({
  corpusPaths = [],
  arenaNearMissPath,
  outputPath = DEFAULT_STEP19_CALL_BAND_OUTPUT_PATH,
} = {}) {
  const corpusRows = [];
  for (const corpusPath of corpusPaths) {
    const content = await fs.readFile(corpusPath, "utf8").catch(() => "");
    if (!content.trim()) continue;
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const sample = JSON.parse(line);
        if (String(sample?.variantId ?? "").toUpperCase() !== "S02") continue;
        if (String(sample?.handClass ?? "") !== "strongSDA5") continue;
        if (Number(sample?.playerCount ?? 0) !== 3) continue;
        corpusRows.push(sample);
      } catch {
        // ignore malformed lines
      }
    }
  }

  const corpusBands = corpusRows.map(deriveCorpusCallBand);
  const arenaRows = (await fs.readFile(arenaNearMissPath, "utf8").catch(() => ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((row) => String(row?.variant ?? "") === "S02");

  const report = {
    variant: "S02",
    corpusStrongSDA5ThreeWaySamples: corpusRows.length,
    corpusStandardBands: summarizeCounts(corpusBands.map((row) => row.standard)),
    corpusReconciledBands: summarizeCounts(corpusBands.map((row) => row.reconciled)),
    arenaStandardBands: summarizeCounts(arenaRows.map((row) => row.callBand)),
    arenaRows: arenaRows.length,
    bandEdges: {
      standard: { tinyMax: 20, smallMax: 40, mediumMax: 80 },
      replayCompatible: {
        tinyPromotedToSmallWhen: "toCall<=limitUnit && street<=1 && potRatio<=0.35 && stackRatio<=0.12",
      },
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
