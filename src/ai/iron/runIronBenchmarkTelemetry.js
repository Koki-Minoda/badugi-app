import fs from "node:fs/promises";
import path from "node:path";

import { loadIronFrozenBenchmarkBaseline } from "./loadIronFrozenBenchmarkBaseline.js";
import { writeIronBenchmarkDrift } from "./detectIronBenchmarkDrift.js";
import { runIronOfflineArena } from "./runIronOfflineArena.js";
import { storeIronMonitorHistory, readIronMonitorHistory } from "./storeIronMonitorHistory.js";
import { writeRollingGovernanceBaseline } from "./buildRollingGovernanceBaseline.js";
import { writeMultiRunGovernanceDrift } from "./evaluateMultiRunGovernanceDrift.js";
import { writeIronTelemetryTrends } from "./analyzeIronTelemetryTrends.js";
import { writeGovernanceEscalation } from "./evaluateGovernanceEscalation.js";
import { writeMonitorRetentionPolicy } from "./defineMonitorRetentionPolicy.js";
import { writeDatasetHitDriftInterpretation } from "./interpretDatasetHitDrift.js";
import { writeIronSeedVariance } from "./auditIronSeedVariance.js";
import { writeSmoothedBenchmarkTelemetry } from "./smoothBenchmarkTelemetry.js";
import { writeHardenedDriftThresholds } from "./hardenDriftThresholds.js";
import { writeOpportunityFrequencyAudit } from "./auditOpportunityFrequency.js";

export const DEFAULT_STEP23_TELEMETRY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step23-benchmark-telemetry.json",
);

const DEFAULT_DETERMINISM_PATH = path.resolve("reports/ai-eval/replay-determinism-audit-iron-step17.json");

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath:
      typeof options.dataset === "string" && options.dataset.trim().length
        ? path.resolve(String(options.dataset))
        : null,
    hands: Number(options.hands ?? 3000),
    seeds:
      typeof options.seeds === "string" && options.seeds.trim().length
        ? options.seeds.split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite)
        : [20260728, 20260729, 20260730],
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : DEFAULT_STEP23_TELEMETRY_OUTPUT_PATH,
    determinismPath:
      typeof options["determinism-path"] === "string" && options["determinism-path"].trim().length
        ? path.resolve(String(options["determinism-path"]))
        : DEFAULT_DETERMINISM_PATH,
    monitoringRunId:
      typeof options["monitoring-run-id"] === "string" && options["monitoring-run-id"].trim().length
        ? String(options["monitoring-run-id"]).trim()
        : typeof options["run-id"] === "string" && options["run-id"].trim().length
          ? String(options["run-id"]).trim()
        : "iron-step23",
    arenaOutputPath:
      typeof options["arena-output"] === "string" && options["arena-output"].trim().length
        ? path.resolve(String(options["arena-output"]))
        : null,
    stabilityOutputPath:
      typeof options["stability-output"] === "string" && options["stability-output"].trim().length
        ? path.resolve(String(options["stability-output"]))
        : null,
    dryRunGateOutputPath:
      typeof options["dryrun-gate-output"] === "string" && options["dryrun-gate-output"].trim().length
        ? path.resolve(String(options["dryrun-gate-output"]))
        : null,
    driftOutputPath:
      typeof options["drift-output"] === "string" && options["drift-output"].trim().length
        ? path.resolve(String(options["drift-output"]))
        : null,
    persistHistory: String(options["persist-history"] ?? "false") === "true",
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function runIronBenchmarkTelemetry({
  datasetPath = null,
  hands = 3000,
  seeds = [20260728, 20260729, 20260730],
  outputPath = DEFAULT_STEP23_TELEMETRY_OUTPUT_PATH,
  determinismPath = DEFAULT_DETERMINISM_PATH,
  monitoringRunId = "iron-step23",
  arenaOutputPath = null,
  stabilityOutputPath = null,
  dryRunGateOutputPath = null,
  driftOutputPath = null,
  persistHistory = false,
  determinismData = null,
  baselineArenaReport = null,
  arenaRunner = runIronOfflineArena,
  baselineLoader = loadIronFrozenBenchmarkBaseline,
  driftWriter = writeIronBenchmarkDrift,
} = {}) {
  const baseline = await baselineLoader();
  const resolvedDatasetPath = datasetPath ?? baseline.dataset;

  const arena = await arenaRunner({
    datasetPath: resolvedDatasetPath,
    variants: baseline.variants,
    hands,
    seeds,
    shadowSourceAttribution: true,
    replayCompatiblePlayercount: true,
    replayCompatibleCallband: true,
    replayCompatiblePressurechain: true,
    outputPath: arenaOutputPath ?? path.resolve(`reports/ai-iron/${monitoringRunId}-stability-arena.json`),
    stabilityOutputPath:
      stabilityOutputPath ?? path.resolve(`reports/ai-iron/${monitoringRunId}-stability-arena-stability.json`),
    dryRunGateOutputPath:
      dryRunGateOutputPath ?? path.resolve(`reports/ai-iron/${monitoringRunId}-stability-dryrun-gate.json`),
  });

  const determinism = determinismData ?? (await readJson(determinismPath));
  const current = {
    arena,
    determinism,
    freezeDecision: baseline.freezeDecision,
    priorityOrdering: baseline.priorityOrdering,
  };

  const drift = await driftWriter({
    baseline: {
      arena: baselineArenaReport ?? (await readJson(path.resolve("reports/ai-iron/iron-step22-stability-arena.json"))),
      priorityOrdering: baseline.priorityOrdering,
    },
    current,
    outputPath: driftOutputPath ?? path.resolve(`reports/ai-iron/${monitoringRunId}-drift-detection.json`),
  });

  const telemetry = {
    monitoringRunId,
    baselineDataset: baseline.dataset,
    variants: baseline.variants,
    arena,
    shadowTelemetry: baseline.shadowTelemetryPolicy,
    determinism,
    drift: {
      status: drift.status,
      warnings: drift.warnings,
      failures: drift.failures,
      checks: drift.checks,
    },
    promoted: false,
    routingChanged: false,
  };

  if (persistHistory) {
    const results = Array.isArray(arena?.results) ? arena.results : [];
    const averageDatasetHitRate = results.length
      ? results.reduce((sum, result) => sum + Number(result?.datasetHitRate ?? 0), 0) / results.length
      : 0;
    const averageIronProGap = results.length
      ? results.reduce((sum, result) => sum + Number(result?.ironProGap ?? 0), 0) / results.length
      : 0;
    const exactOpportunities = results.reduce(
      (sum, result) => sum + Number(result?.targetBucketProfile?.exactOpportunities ?? 0),
      0,
    );
    const exactOpportunityRate = results.length > 0 ? exactOpportunities / Math.max(1, hands * results.length) : 0;

    const interpretation = await writeDatasetHitDriftInterpretation({
      baselineHitRate: drift?.baseline?.datasetHitRate ?? 0,
      currentHitRate: drift?.current?.datasetHitRate ?? 0,
      sameActionRate: baseline?.freezeDecision?.sameActionRate ?? 1,
      exactOpportunities,
      deterministicReplay: determinism?.deterministic,
      invalidReplayCount: determinism?.invalidReplayCount ?? 0,
      matcherRegressionSignals: results.some(
        (result) => Number(result?.illegal ?? 0) > 0 || Number(result?.freeze ?? 0) > 0,
      ),
      datasetRegressionSignals: false,
      seedVarianceSignals: results.some((result) => (result?.perSeed ?? []).length < 3),
    });

    const seedVariance = await writeIronSeedVariance({ arena });
    const smoothed = await writeSmoothedBenchmarkTelemetry({
      runs: [
        {
          datasetHitRate: drift?.baseline?.datasetHitRate ?? 0,
          ironProGap:
            results.length > 0
              ? results.reduce((sum, result) => sum + Number(result?.ironProGap ?? 0), 0) / results.length
              : 0,
          exactOpportunityRate: 0,
        },
        {
          datasetHitRate: averageDatasetHitRate,
          ironProGap: averageIronProGap,
          exactOpportunityRate,
        },
      ],
    });
    const hardened = await writeHardenedDriftThresholds({
      rawDriftStatus: drift.status,
      sameActionRate: baseline?.freezeDecision?.sameActionRate ?? 1,
      ironProGaps: results.map((result) => Number(result?.ironProGap ?? 0)),
      rollingDatasetHitRateDrop:
        Number(drift?.baseline?.datasetHitRate ?? 0) > 0
          ? (Number(drift?.baseline?.datasetHitRate ?? 0) - Number(smoothed.rollingDatasetHitRate ?? 0)) /
            Number(drift?.baseline?.datasetHitRate ?? 1)
          : 0,
      exactOpportunityRateCollapse: exactOpportunities === 0,
    });
    const opportunityFrequency = await writeOpportunityFrequencyAudit({
      baselineArena: baselineArenaReport ?? (await readJson(path.resolve("reports/ai-iron/iron-step22-stability-arena.json"))),
      currentArena: arena,
    });

    telemetry.governance = {
      interpretation,
      seedVariance,
      rollingBaseline: smoothed,
      hardenedStatus: hardened.hardenedStatus,
      thresholdHardening: hardened,
      opportunityFrequency,
    };

    const historyTelemetry = {
      ...telemetry,
      sameActionRate: baseline?.freezeDecision?.sameActionRate ?? 1,
      exactOpportunityRate,
      proFallbackRate:
        results.length > 0
          ? results.reduce((sum, result) => sum + Number(result?.proFallbackRate ?? 0), 0) / results.length
          : 1,
    };
    await storeIronMonitorHistory({ telemetry: historyTelemetry });
    const history = await readIronMonitorHistory();
    const rollingBaseline = await writeRollingGovernanceBaseline({ history });
    const governanceDrift = await writeMultiRunGovernanceDrift({ history, rollingBaseline });
    const trends = await writeIronTelemetryTrends({ history });
    const escalation = await writeGovernanceEscalation({
      governanceHistory: history.map((entry) => ({
        status: String(entry?.hardenedStatus ?? entry?.rawStatus ?? "PASS"),
      })),
    });
    const retentionPolicy = await writeMonitorRetentionPolicy();
    telemetry.governance = {
      ...telemetry.governance,
      rollingBaseline,
      governanceDrift,
      trends,
      escalation,
      retentionPolicy,
    };
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(telemetry, null, 2), "utf8");
  return telemetry;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const telemetry = await runIronBenchmarkTelemetry(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(telemetry, null, 2));
}
