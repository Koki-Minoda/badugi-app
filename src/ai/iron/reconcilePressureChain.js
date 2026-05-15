import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP19_PRESSURE_CHAIN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-pressure-chain-reconciliation-step19.json",
);

export function replayCompatiblePressureChain({
  pressureChain = "",
  repeatedPressure = "",
} = {}) {
  const normalizedChain = String(pressureChain ?? "");
  const normalizedRepeat = String(repeatedPressure ?? "");
  if (normalizedChain === "firstRaiseAfterCall") {
    return {
      pressureChain: normalizedChain,
      repeatedPressure: "repeated",
      family: "pressure-after-call",
      reconciled: true,
    };
  }
  return {
    pressureChain: normalizedChain,
    repeatedPressure: normalizedRepeat,
    family: normalizedChain || normalizedRepeat || "unknown",
    reconciled: false,
  };
}

function summarizeCounts(values = []) {
  const counts = {};
  for (const value of values) {
    const key = String(value ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function auditS02PressureChainReconciliation({
  arenaNearMissPath,
  outputPath = DEFAULT_STEP19_PRESSURE_CHAIN_OUTPUT_PATH,
} = {}) {
  const rows = (await fs.readFile(arenaNearMissPath, "utf8").catch(() => ""))
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

  const reconciled = rows.map((row) =>
    replayCompatiblePressureChain({
      pressureChain: row.pressureChain,
      repeatedPressure: row.repeatedPressure,
    }),
  );

  const report = {
    variant: "S02",
    rawPressureChains: summarizeCounts(rows.map((row) => row.pressureChain)),
    rawRepeatedFlags: summarizeCounts(rows.map((row) => row.repeatedPressure)),
    reconciledRepeatedFlags: summarizeCounts(reconciled.map((row) => row.repeatedPressure)),
    reconciledFamilies: summarizeCounts(reconciled.map((row) => row.family)),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
