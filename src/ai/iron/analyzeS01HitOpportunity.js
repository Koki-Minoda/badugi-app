import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ARENA_RESULT_PATH = path.resolve("reports/ai-iron/iron-step11-offline-arena-result.json");
const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/s01-hit-opportunity-step11.json");
const TARGET_BUCKET = "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated";

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    arenaResultPath:
      typeof options["arena-result"] === "string" && options["arena-result"].trim().length
        ? path.resolve(String(options["arena-result"]))
        : DEFAULT_ARENA_RESULT_PATH,
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : DEFAULT_OUTPUT_PATH,
  };
}

export async function analyzeS01HitOpportunity({
  arenaResultPath = DEFAULT_ARENA_RESULT_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const report = JSON.parse(await fs.readFile(arenaResultPath, "utf8"));
  const s01 = (report.results ?? []).find((entry) => entry.variant === "S01") ?? {};
  const exactHits = Number(s01.bucketHitDistribution?.[TARGET_BUCKET] ?? 0);
  const opportunityCount = Number(s01.candidateBucketObservations?.[TARGET_BUCKET] ?? 0);
  const fallbackReasons = s01.fallbackReasonByBucket?.[TARGET_BUCKET] ?? {};
  const result = {
    arenaId: report.arenaId ?? "iron-step11",
    targetBucket: TARGET_BUCKET,
    variant: "S01",
    exactHits,
    opportunityCount,
    noMatchingState: Math.max(0, opportunityCount - exactHits - Object.values(fallbackReasons).reduce((sum, value) => sum + Number(value ?? 0), 0)),
    actionIllegal: Number(fallbackReasons["action-illegal"] ?? 0),
    bucketMismatch: Number(fallbackReasons["bucket-mismatch"] ?? 0),
    noDatasetMatch: Number(fallbackReasons["no-dataset-match"] ?? 0),
    fallbackReasonByBucket: fallbackReasons,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  return result;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await analyzeS01HitOpportunity(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
