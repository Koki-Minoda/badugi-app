import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_REPLAY_LINKS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-replay-links.json",
);

function query(params = {}) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ).toString();
}

export function createReplayDeepLink(link = {}) {
  const href = `/replay?${query({
    variant: link.variant,
    seed: link.seed,
    hand: link.handId,
    actionIndex: link.actionIndex,
    lesson: link.candidateId,
  })}`;
  return {
    lessonId: link.candidateId,
    href,
    deterministic: link.replayDeterministic === true,
    replayRefValid:
      Boolean(link.variant) &&
      link.seed !== null &&
      link.seed !== undefined &&
      link.handId !== null &&
      link.handId !== undefined &&
      link.actionIndex !== null &&
      link.actionIndex !== undefined,
    replayRef: link.replayRef ?? null,
  };
}

export function buildReplayLinksSummary({ replayMetadata = {} } = {}) {
  const links = (replayMetadata.links ?? []).map(createReplayDeepLink);
  return {
    generatedAt: new Date().toISOString(),
    source: "step47-replay-deeplink-metadata",
    linkCount: links.length,
    links,
    deterministic: links.every((link) => link.deterministic),
    replayRefValid: links.every((link) => link.replayRefValid),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function buildReplayDeepLinks({
  replayMetadataPath = path.resolve("reports/ai-iron/step47-replay-deeplink-metadata.json"),
  outputPath = DEFAULT_STEP48_REPLAY_LINKS_OUTPUT_PATH,
  replayMetadata = null,
} = {}) {
  const report = buildReplayLinksSummary({
    replayMetadata: replayMetadata ?? (await readJson(replayMetadataPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayDeepLinks();
  console.log(JSON.stringify(report, null, 2));
}
