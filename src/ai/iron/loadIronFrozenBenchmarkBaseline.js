import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FROZEN_BENCHMARK_BASELINE_PATH = path.resolve(
  "reports/ai-iron/iron-step22-benchmark-baseline.json",
);
export const DEFAULT_FROZEN_FREEZE_DECISION_PATH = path.resolve(
  "reports/ai-iron/source-priority-freeze-decision-step22.json",
);
export const DEFAULT_FROZEN_SHADOW_POLICY_PATH = path.resolve(
  "reports/ai-iron/shadow-telemetry-policy-step22.json",
);
export const DEFAULT_FROZEN_GUARDRAILS_PATH = path.resolve(
  "reports/ai-iron/iron-expansion-guardrails-step22.json",
);
export const DEFAULT_FROZEN_ARENA_BASELINE_PATH = path.resolve(
  "reports/ai-iron/iron-step22-stability-arena.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function summarizeArenaMetrics(arenaReport = {}) {
  const results = Array.isArray(arenaReport?.results) ? arenaReport.results : [];
  const byVariant = Object.fromEntries(
    results.map((result) => [
      String(result?.variant ?? ""),
      {
        ironProGap: Number(result?.ironProGap ?? 0),
        ironStandardGap: Number(result?.ironStandardGap ?? 0),
        datasetHitRate: Number(result?.datasetHitRate ?? 0),
        proFallbackRate: Number(result?.proFallbackRate ?? 0),
        illegal: Number(result?.illegal ?? 0),
        freeze: Number(result?.freeze ?? 0),
      },
    ]),
  );
  const aggregate = {
    datasetHitRate: Number(
      (
        results.reduce((sum, result) => sum + Number(result?.datasetHitRate ?? 0), 0) /
        Math.max(1, results.length)
      ).toFixed(4),
    ),
    proFallbackRate: Number(
      (
        results.reduce((sum, result) => sum + Number(result?.proFallbackRate ?? 0), 0) /
        Math.max(1, results.length)
      ).toFixed(4),
    ),
  };
  return {
    arenaId: arenaReport?.arenaId ?? null,
    byVariant,
    aggregate,
  };
}

export async function loadIronFrozenBenchmarkBaseline({
  baselinePath = DEFAULT_FROZEN_BENCHMARK_BASELINE_PATH,
  freezeDecisionPath = DEFAULT_FROZEN_FREEZE_DECISION_PATH,
  shadowTelemetryPolicyPath = DEFAULT_FROZEN_SHADOW_POLICY_PATH,
  guardrailsPath = DEFAULT_FROZEN_GUARDRAILS_PATH,
  arenaBaselinePath = DEFAULT_FROZEN_ARENA_BASELINE_PATH,
} = {}) {
  const baseline = await readJson(baselinePath);
  const freezeDecision = await readJson(freezeDecisionPath);
  const shadowTelemetryPolicy = await readJson(shadowTelemetryPolicyPath);
  const guardrails = await readJson(guardrailsPath);
  let arenaBaseline = null;
  try {
    arenaBaseline = await readJson(arenaBaselinePath);
  } catch {
    arenaBaseline = null;
  }

  return {
    dataset: baseline.dataset,
    variants: Array.isArray(baseline.variants) ? baseline.variants : [],
    priorityFrozen: Boolean(shadowTelemetryPolicy?.priorityFrozen),
    shadowTelemetryEnabled: Boolean(shadowTelemetryPolicy?.shadowTelemetryEnabled),
    promoted: false,
    routingChanged: false,
    freezeDecision,
    shadowTelemetryPolicy,
    guardrails,
    priorityOrdering: Array.isArray(baseline.priorityOrdering) ? baseline.priorityOrdering : [],
    sourceTypeCounts: baseline.sourceTypeCounts ?? {},
    baselineMetrics: arenaBaseline ? summarizeArenaMetrics(arenaBaseline) : {},
  };
}
