import fs from "node:fs/promises";
import path from "node:path";

import {
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step7-action-value.jsonl");
const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-eval/stable-neighbor-candidates-step10.json");
const REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");

export const STEP10_STABLE_PARENT_BUCKETS = {
  D02: ["strongA5 second-pressure"],
  S01: ["strongSD27 top-end pressure"],
  S02: ["strongSDA5 CALL/FOLD/RAISE"],
};

const STEP10_PARENT_BY_HAND_CLASS = {
  D02: {
    strongA5: "strongA5 second-pressure",
  },
  S01: {
    strongSD27: "strongSD27 top-end pressure",
  },
  S02: {
    strongSDA5: "strongSDA5 CALL/FOLD/RAISE",
  },
};

export const STEP10_SOURCE_TAGS = ["iron-step5", "iron-step6"];
export const STEP11_SOURCE_TAGS = ["iron-step5", "iron-step6"];
export const STEP11_S02_ACCEPTED_NEIGHBOR =
  "strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=blind::call=small::repeat=repeated";
export const STEP12_SOURCE_TAGS = ["iron-step5", "iron-step6"];
export const STEP12_S02_ACCEPTED_NEIGHBOR =
  "strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=IP::call=small::repeat=repeated";
export const STEP14_S02_V3_PARENT_BUCKET =
  "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizePlayerCountBand(playerCount = 0) {
  if (playerCount <= 2) return "HU";
  if (playerCount === 3) return "3way";
  return "4way+";
}

export function normalizePositionBand(position = "") {
  const normalized = String(position ?? "").toLowerCase();
  if (normalized.includes("button")) return "button";
  if (normalized.includes("blind")) return "blind";
  if (["cutoff", "late"].includes(normalized)) return "IP";
  return "OOP";
}

export function normalizeToCallBand(toCall = 0) {
  if (toCall <= 20) return "tiny";
  if (toCall <= 40) return "small";
  if (toCall <= 80) return "medium";
  return "large";
}

export function normalizeRepeatedPressureFlag(facingAction = "") {
  return String(facingAction ?? "").toLowerCase() === "raise" ? "repeated" : "single";
}

export function extractToCall(legalActions = [], snapshot = {}, seatIndex = null) {
  const list = Array.isArray(legalActions) ? legalActions : [];
  const direct = Math.max(
    0,
    ...list
      .map((action) => toNumber(action?.toCall, NaN))
      .filter((value) => Number.isFinite(value)),
  );
  if (direct > 0) return direct;
  const currentBet = toNumber(snapshot?.currentBet ?? snapshot?.metadata?.currentBet, 0);
  if (!Number.isInteger(seatIndex)) return currentBet;
  const player = snapshot?.players?.[seatIndex] ?? {};
  const playerBet = toNumber(player?.betThisRound ?? player?.betThisStreet ?? player?.bet, 0);
  return Math.max(0, currentBet - playerBet);
}

export function classifyStableNeighborContext(input = {}) {
  const variantId = String(input.variantId ?? "").toUpperCase();
  const handClass = String(input.handClass ?? "");
  const parentStableBucket = STEP10_PARENT_BY_HAND_CLASS[variantId]?.[handClass] ?? null;
  const facingAction = String(input.facingAction ?? "").toLowerCase();
  if (!parentStableBucket) return null;
  if (!["bet", "raise"].includes(facingAction)) return null;
  const playerCount = toNumber(input.playerCount, 0);
  const position = String(input.position ?? "");
  const toCall = extractToCall(input.legalActions, input.snapshot, input.actorSeat);
  const axes = {
    playerCountBand: normalizePlayerCountBand(playerCount),
    positionBand: normalizePositionBand(position),
    toCallBand: normalizeToCallBand(toCall),
    repeatedPressure: normalizeRepeatedPressureFlag(facingAction),
  };
  const subBucketId = [
    parentStableBucket,
    `pc=${axes.playerCountBand}`,
    `pos=${axes.positionBand}`,
    `call=${axes.toCallBand}`,
    `repeat=${axes.repeatedPressure}`,
  ].join("::");
  return {
    variantId,
    handClass,
    parentStableBucket,
    subBucketId,
    axes,
    metadata: {
      playerCount,
      position,
      facingAction,
      toCall,
    },
  };
}

export function countAxisDifferences(left = {}, right = {}) {
  const axes = ["playerCountBand", "positionBand", "toCallBand", "repeatedPressure"];
  let count = 0;
  let differingAxis = null;
  for (const axis of axes) {
    if (String(left?.[axis] ?? "") !== String(right?.[axis] ?? "")) {
      count += 1;
      differingAxis = axis;
    }
  }
  return { count, differingAxis };
}

export function parseSubBucketAxes(subBucketId = "") {
  const [, ...parts] = String(subBucketId ?? "").split("::");
  const entries = Object.fromEntries(
    parts.map((part) => {
      const [key, value = ""] = String(part).split("=");
      return [key, value];
    }),
  );
  return {
    playerCountBand: entries.pc ?? "",
    positionBand: entries.pos ?? "",
    toCallBand: entries.call ?? "",
    repeatedPressure: entries.repeat ?? "",
  };
}

async function readExistingDatasetRows(datasetPath = DEFAULT_DATASET_PATH) {
  const content = await fs.readFile(datasetPath, "utf8").catch(() => "");
  return content
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
    .filter(Boolean);
}

export async function readNeighborSourceSamples({
  variants = ["D02", "S01", "S02"],
  sourceTags = STEP10_SOURCE_TAGS,
} = {}) {
  const entries = await fs.readdir(REPLAY_SAMPLE_DIR).catch(() => []);
  const wanted = new Set(variants.map((variant) => String(variant).toLowerCase()));
  const wantedTags = new Set(sourceTags.map((tag) => String(tag).toLowerCase()));
  const chosenEntries = new Map();
  for (const entry of entries) {
    const parsed = parseReplaySampleFilename(entry);
    if (!parsed) continue;
    if (!wanted.has(parsed.variant.toLowerCase())) continue;
    if (!wantedTags.has(String(parsed.tag).toLowerCase())) continue;
    const key = `${parsed.variant}:${parsed.seed}`;
    const current = chosenEntries.get(key);
    if (!current || replaySampleTagPriority(parsed.tag) > replaySampleTagPriority(current.tag)) {
      chosenEntries.set(key, { entry, ...parsed });
    }
  }

  const samples = [];
  for (const { entry, tag } of chosenEntries.values()) {
    const content = await fs.readFile(path.join(REPLAY_SAMPLE_DIR, entry), "utf8");
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        let sample = null;
        try {
          sample = JSON.parse(line);
        } catch {
          return;
        }
        const tagged = { ...sample, sampleTag: tag };
        if (!shouldKeepReplaySample(tagged)) return;
        samples.push(tagged);
      });
  }
  return samples;
}

export async function discoverStableNeighborBuckets({
  datasetPath = DEFAULT_DATASET_PATH,
  variants = ["D02", "S01", "S02"],
  sourceTags = STEP10_SOURCE_TAGS,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const rows = await readExistingDatasetRows(datasetPath);
  const targetParents = new Set(
    variants.flatMap((variant) => STEP10_STABLE_PARENT_BUCKETS[String(variant).toUpperCase()] ?? []),
  );

  const stableSubBuckets = new Map();
  for (const row of rows) {
    if (!targetParents.has(row.bucket)) continue;
    const classified = classifyStableNeighborContext({
      variantId: row.variantId,
      handClass: row.handClass,
      playerCount: row.metadata?.playerCount,
      position: row.metadata?.position,
      facingAction: row.metadata?.facingAction,
      legalActions: row.legalActions,
      actorSeat: row.metadata?.actorSeat,
    });
    if (!classified) continue;
    const key = `${classified.variantId}|${classified.subBucketId}`;
    if (!stableSubBuckets.has(key)) {
      stableSubBuckets.set(key, {
        variantId: classified.variantId,
        parentStableBucket: classified.parentStableBucket,
        subBucketId: classified.subBucketId,
        axes: classified.axes,
        sampleCount: 0,
      });
    }
    stableSubBuckets.get(key).sampleCount += 1;
  }

  const sourceSamples = await readNeighborSourceSamples({ variants, sourceTags });
  const candidateMap = new Map();
  for (const sample of sourceSamples) {
    const classified = classifyStableNeighborContext(sample);
    if (!classified) continue;
    const stableMatches = [...stableSubBuckets.values()].filter(
      (entry) =>
        entry.variantId === classified.variantId &&
        entry.parentStableBucket === classified.parentStableBucket,
    );
    if (!stableMatches.length) continue;
    if (stableSubBuckets.has(`${classified.variantId}|${classified.subBucketId}`)) continue;
    const neighborMatch = stableMatches
      .map((entry) => ({
        stable: entry,
        ...countAxisDifferences(entry.axes, classified.axes),
      }))
      .filter((entry) => entry.count === 1)
      .sort((left, right) => left.stable.sampleCount - right.stable.sampleCount)[0];
    if (!neighborMatch) continue;
    const key = `${classified.variantId}|${classified.subBucketId}`;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, {
        variantId: classified.variantId,
        handClass: classified.handClass,
        parentStableBucket: classified.parentStableBucket,
        subBucketId: classified.subBucketId,
        axes: classified.axes,
        sampleCount: 0,
        sourceTags: new Set(),
        sourceSeeds: new Set(),
        neighborAxis: neighborMatch.differingAxis,
        nearestStableSubBucket: neighborMatch.stable.subBucketId,
      });
    }
    const aggregate = candidateMap.get(key);
    aggregate.sampleCount += 1;
    aggregate.sourceTags.add(sample.sampleTag);
    aggregate.sourceSeeds.add(sample.seed);
  }

  const result = {
    createdAt: new Date().toISOString(),
    datasetPath,
    variants,
    sourceTags,
    stableSubBuckets: [...stableSubBuckets.values()].sort((left, right) =>
      left.subBucketId.localeCompare(right.subBucketId),
    ),
    neighborCandidates: [...candidateMap.values()]
      .map((entry) => ({
        ...entry,
        sourceTags: [...entry.sourceTags].sort(),
        sourceSeeds: [...entry.sourceSeeds].sort((left, right) => left - right),
      }))
      .sort((left, right) => right.sampleCount - left.sampleCount || left.subBucketId.localeCompare(right.subBucketId)),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  return result;
}

export async function discoverS02NeighborV2Candidates({
  sourceTags = STEP11_SOURCE_TAGS,
  outputPath = path.resolve("reports/ai-eval/s02-neighbor-v2-candidates-step11.json"),
} = {}) {
  const anchorAxes = parseSubBucketAxes(STEP11_S02_ACCEPTED_NEIGHBOR);
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const allowedAxes = new Set(["playerCountBand", "positionBand", "toCallBand", "repeatedPressure"]);
  const candidateMap = new Map();

  for (const sample of sourceSamples) {
    const classified = classifyStableNeighborContext(sample);
    if (!classified) continue;
    if (classified.variantId !== "S02") continue;
    if (classified.parentStableBucket !== "strongSDA5 CALL/FOLD/RAISE") continue;
    if (classified.handClass !== "strongSDA5") continue;
    if (classified.metadata?.toCall > 40) continue;
    const diff = countAxisDifferences(anchorAxes, classified.axes);
    if (diff.count !== 1 || !allowedAxes.has(diff.differingAxis)) continue;
    const key = classified.subBucketId;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, {
        variantId: "S02",
        parentStableBucket: classified.parentStableBucket,
        anchorStableBucket: STEP11_S02_ACCEPTED_NEIGHBOR,
        subBucketId: key,
        axes: classified.axes,
        neighborAxis: diff.differingAxis,
        sampleCount: 0,
        sourceTags: new Set(),
        sourceSeeds: new Set(),
      });
    }
    const entry = candidateMap.get(key);
    entry.sampleCount += 1;
    entry.sourceTags.add(String(sample.sampleTag ?? ""));
    entry.sourceSeeds.add(Number(sample.seed ?? 0));
  }

  const report = {
    createdAt: new Date().toISOString(),
    anchorStableBucket: STEP11_S02_ACCEPTED_NEIGHBOR,
    variants: ["S02"],
    sourceTags,
    neighborCandidates: [...candidateMap.values()]
      .map((entry) => ({
        ...entry,
        sourceTags: [...entry.sourceTags].sort(),
        sourceSeeds: [...entry.sourceSeeds].sort((a, b) => a - b),
      }))
      .sort((left, right) => right.sampleCount - left.sampleCount || left.subBucketId.localeCompare(right.subBucketId)),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function discoverS02NeighborV3Candidates({
  sourceTags = STEP12_SOURCE_TAGS,
  outputPath = path.resolve("reports/ai-eval/s02-neighbor-v3-candidates-step12.json"),
} = {}) {
  const anchorAxes = parseSubBucketAxes(STEP12_S02_ACCEPTED_NEIGHBOR);
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const allowedAxes = new Set(["playerCountBand", "positionBand", "toCallBand", "repeatedPressure"]);
  const candidateMap = new Map();

  for (const sample of sourceSamples) {
    const classified = classifyStableNeighborContext(sample);
    if (!classified) continue;
    if (classified.variantId !== "S02") continue;
    if (classified.parentStableBucket !== "strongSDA5 CALL/FOLD/RAISE") continue;
    if (classified.handClass !== "strongSDA5") continue;
    if (classified.metadata?.toCall > 40) continue;
    const diff = countAxisDifferences(anchorAxes, classified.axes);
    if (diff.count !== 1 || !allowedAxes.has(diff.differingAxis)) continue;
    const key = classified.subBucketId;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, {
        variantId: "S02",
        parentStableBucket: classified.parentStableBucket,
        anchorStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
        subBucketId: key,
        axes: classified.axes,
        neighborAxis: diff.differingAxis,
        sampleCount: 0,
        sourceTags: new Set(),
        sourceSeeds: new Set(),
      });
    }
    const entry = candidateMap.get(key);
    entry.sampleCount += 1;
    entry.sourceTags.add(String(sample.sampleTag ?? ""));
    entry.sourceSeeds.add(Number(sample.seed ?? 0));
  }

  const report = {
    createdAt: new Date().toISOString(),
    anchorStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
    variants: ["S02"],
    sourceTags,
    neighborCandidates: [...candidateMap.values()]
      .map((entry) => ({
        ...entry,
        sourceTags: [...entry.sourceTags].sort(),
        sourceSeeds: [...entry.sourceSeeds].sort((a, b) => a - b),
      }))
      .sort((left, right) => right.sampleCount - left.sampleCount || left.subBucketId.localeCompare(right.subBucketId)),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function discoverS02V3IsolationCandidates({
  analysisPath = path.resolve("reports/ai-eval/s02-v3-noise-entropy-step14.json"),
  outputPath = path.resolve("reports/ai-eval/s02-v3-isolation-candidates-step14.json"),
} = {}) {
  const report = JSON.parse(await fs.readFile(analysisPath, "utf8"));
  const candidates = (report.isolationCandidates ?? []).map((candidate) => ({
    variantId: "S02",
    parentStableBucket: STEP14_S02_V3_PARENT_BUCKET,
    subBucketId: `${STEP14_S02_V3_PARENT_BUCKET}::${candidate.axis}=${candidate.value}`,
    neighborAxis: candidate.axis,
    isolationAxis: candidate.axis,
    isolationValue: candidate.value,
    verdict: candidate.verdict,
    sampleCount: candidate.sampleCount,
    meanDelta: candidate.meanDelta,
    signFlipRate: candidate.signFlipRate,
    confidence: candidate.confidence,
    repairRate: candidate.repairRate,
    entropyScore: candidate.entropyScore,
  }));

  const output = {
    createdAt: new Date().toISOString(),
    targetBucket: STEP14_S02_V3_PARENT_BUCKET,
    baseEntropyScore: report.baseMetrics?.entropyScore ?? null,
    baseSignFlipRate: report.baseMetrics?.signFlipRate ?? null,
    isolationCandidates: candidates,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
  return output;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await discoverStableNeighborBuckets();
  console.log(JSON.stringify({
    outputPath: DEFAULT_OUTPUT_PATH,
    stableSubBuckets: result.stableSubBuckets.length,
    neighborCandidates: result.neighborCandidates.length,
  }, null, 2));
}
