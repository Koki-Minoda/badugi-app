import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-offline-arena-candidate.json");

export function createOfflineArenaMetadata({
  datasetPath,
  qualityGate,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  return {
    candidateTier: "iron-candidate",
    dataset: datasetPath,
    variantCoverage: Object.keys(qualityGate?.variantCoverage ?? {}),
    deterministicReplay: Boolean(qualityGate?.deterministicReplay),
    invalidReplayCount: Number(qualityGate?.invalidReplayCount ?? 0),
    eligibleForOfflineArena: Boolean(qualityGate?.eligibleForOfflineArena),
    eligibleForPromotion: false,
    promoted: false,
    routingChanged: false,
    outputPath,
  };
}

export async function writeOfflineArenaMetadata({
  datasetPath,
  qualityGate,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const metadata = createOfflineArenaMetadata({ datasetPath, qualityGate, outputPath });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}
