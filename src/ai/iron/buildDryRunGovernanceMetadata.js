import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP22_GOVERNANCE_METADATA_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step22-governance-metadata.json",
);

export function buildDryRunGovernanceMetadata({
  candidateTier = "iron-dryrun",
  priorityFrozen = true,
  shadowTelemetryEnabled = true,
  gameplayMutation = false,
  outputPath = DEFAULT_STEP22_GOVERNANCE_METADATA_OUTPUT_PATH,
} = {}) {
  return {
    candidateTier,
    promotionEligible: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: Boolean(priorityFrozen),
    shadowTelemetryEnabled: Boolean(shadowTelemetryEnabled),
    gameplayMutation: Boolean(gameplayMutation),
    outputPath,
  };
}

export async function writeDryRunGovernanceMetadata({
  candidateTier = "iron-dryrun",
  priorityFrozen = true,
  shadowTelemetryEnabled = true,
  gameplayMutation = false,
  outputPath = DEFAULT_STEP22_GOVERNANCE_METADATA_OUTPUT_PATH,
} = {}) {
  const metadata = buildDryRunGovernanceMetadata({
    candidateTier,
    priorityFrozen,
    shadowTelemetryEnabled,
    gameplayMutation,
    outputPath,
  });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}
