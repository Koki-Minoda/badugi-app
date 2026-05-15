import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";
import {
  buildCoachingHandoffPackageSummary,
  STEP47_CANDIDATES_PATH,
  STEP47_PREEXPORT_ROWS_PATH,
  STEP47_REPEATABILITY_PATH,
} from "./buildCoachingHandoffPackage.js";
import { readJsonl } from "./buildRLSignalPreview.js";
import { readJson } from "./coverageAuditUtils.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP47_REPLAY_DEEPLINK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-replay-deeplink-metadata.json",
);

export function buildReplayDeepLinkMetadataSummary({ handoff = {} } = {}) {
  const links = (handoff.candidates ?? []).map((candidate) => {
    const ref = candidate.replayReference ?? {};
    return {
      candidateId: candidate.candidateId,
      spot: candidate.spot,
      variant: candidate.variantId,
      seed: ref.seed,
      handId: ref.handId,
      actionIndex: ref.actionIndex,
      decisionIndex: ref.decisionIndex,
      playerCount: candidate.playerCount,
      lessonTag: candidate.lessonTag,
      bucket: candidate.bucket,
      replayDeterministic: ref.replayDeterministic === true,
      replayRef: `${ref.runId ?? "step46"}:${ref.seed ?? "seed"}:${ref.handId ?? "hand"}:${ref.actionIndex ?? "decision"}`,
      viewerRoutePreview: `/replay/${candidate.variantId}/${ref.seed ?? "unknown"}/${ref.handId ?? "unknown"}?decision=${ref.actionIndex ?? 0}`,
      referenceSource: ref.referenceSource ?? "step47-handoff",
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: "step47-coaching-handoff-package",
    linkCount: links.length,
    links,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function buildReplayDeepLinkMetadata({
  outputPath = DEFAULT_STEP47_REPLAY_DEEPLINK_OUTPUT_PATH,
  handoff = null,
  candidates = null,
  preexportRows = null,
  repeatability = null,
} = {}) {
  const report = buildReplayDeepLinkMetadataSummary({
    handoff:
      handoff ??
      buildCoachingHandoffPackageSummary({
        candidates: candidates ?? (await readJsonl(STEP47_CANDIDATES_PATH)),
        preexportRows: preexportRows ?? (await readPreExportRows(STEP47_PREEXPORT_ROWS_PATH)),
        repeatability: repeatability ?? (await readJson(STEP47_REPEATABILITY_PATH)),
      }),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayDeepLinkMetadata();
  console.log(JSON.stringify(report, null, 2));
}
