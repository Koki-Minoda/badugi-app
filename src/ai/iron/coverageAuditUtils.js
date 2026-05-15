import fs from "node:fs/promises";
import path from "node:path";

import { bucketForReplaySample } from "../evaluation/counterfactualBuckets.js";

export const STEP27_VARIANTS = ["D02", "S01", "S02"];
export const DEFAULT_STEP26_ARENA_PATHS = [1, 2, 3, 4].map((run) =>
  path.resolve(`reports/ai-iron/iron-step26-run${run}-stability-arena.json`),
);

export function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

export function average(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;
}

export function sum(values = []) {
  return values.map((value) => Number(value ?? 0)).filter(Number.isFinite).reduce((total, value) => total + value, 0);
}

export function actionType(action = null) {
  return String(action?.type ?? action ?? "").toUpperCase();
}

export function playerCountClass(playerCount = 0) {
  const count = Number(playerCount ?? 0);
  if (count >= 4) return "4way+";
  if (count === 3) return "3way";
  if (count > 0) return "heads-up";
  return "unknown";
}

export function pressureFamily(entry = {}) {
  const facing = String(entry?.facingAction ?? "none").toLowerCase();
  if (facing === "raise") return "raise-pressure";
  if (facing === "bet") return "bet-pressure";
  return "open-or-checkback";
}

export function callBand(entry = {}) {
  const facing = String(entry?.facingAction ?? "none").toLowerCase();
  const drawRound = Number(entry?.drawRound ?? 0);
  if (facing === "none") return "none";
  if (drawRound >= 2) return "big";
  return "small";
}

export function inferBucketFamily(entry = {}) {
  const mapped = bucketForReplaySample({
    variantId: entry.variantId,
    handClass: entry.handClass,
    sampleTag: entry.sampleTag,
  });
  if (mapped) return mapped;
  const handClass = String(entry?.handClass ?? "unknown");
  return `${handClass} ${pressureFamily(entry)}`;
}

export function isDoNotTouchBucket(entry = {}) {
  const text = `${entry?.variantId ?? ""} ${entry?.bucket ?? ""} ${entry?.bucketFamily ?? ""} ${entry?.handClass ?? ""}`.toLowerCase();
  return (
    text.includes("d01") ||
    text.includes("weak") ||
    text.includes("trash") ||
    Number(entry?.signFlipRate ?? 0) > 0.35 ||
    Number(entry?.repairRate ?? 0) > 0.05 ||
    Boolean(entry?.requiresGameplayMutation) ||
    Boolean(entry?.sourcePriorityOverride)
  );
}

export function classifyCandidate(entry = {}) {
  if (isDoNotTouchBucket(entry)) return "DO_NOT_TOUCH";
  const frequency = Number(entry?.frequency ?? entry?.freq ?? entry?.sampleCount ?? 0);
  const confidence = Number(entry?.confidence ?? 0);
  const standardAdvantage = Number(entry?.standardAdvantage ?? entry?.standardGap ?? 0);
  const proFallbackRate = Number(entry?.proFallbackRate ?? 0);
  const ironProGap = Number(entry?.ironProGap ?? 0);
  if (frequency >= 20 && confidence >= 0.7 && standardAdvantage > 0 && proFallbackRate >= 0.99 && ironProGap <= 1.5) {
    return "EXPAND_DATASET";
  }
  if (frequency >= 5 && standardAdvantage > 0) return "NEEDS_COUNTERFACTUAL";
  return "DO_NOT_TOUCH";
}

export function candidatePriority(classification = "") {
  switch (classification) {
    case "EXPAND_DATASET":
      return "P1_EXPAND_NEXT";
    case "NEEDS_COUNTERFACTUAL":
      return "P2_COUNTERFACTUAL_FIRST";
    case "DO_NOT_TOUCH":
      return "DO_NOT_TOUCH";
    default:
      return "P3_MONITOR_ONLY";
  }
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJsonReport(outputPath, report) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ ...report, outputPath }, null, 2), "utf8");
  return { ...report, outputPath };
}

export async function loadArenaReports(paths = DEFAULT_STEP26_ARENA_PATHS) {
  const reports = [];
  for (const filePath of paths) {
    try {
      reports.push(await readJson(filePath));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return reports;
}

export function flattenArenaResults(arenaReports = []) {
  return arenaReports.flatMap((report) =>
    (report?.results ?? [])
      .filter((result) => STEP27_VARIANTS.includes(String(result?.variant ?? "")))
      .map((result) => ({ ...result, arenaId: report?.arenaId ?? null })),
  );
}

export async function loadStep4TActionDivergenceReports(dir = path.resolve("reports/ai-eval")) {
  const files = await fs.readdir(dir);
  const selected = files
    .filter((file) => /^pro-vs-standard-\d{8}-s02-s01-d02-300-step4t\.json$/i.test(file))
    .sort();
  const reports = [];
  for (const file of selected) {
    reports.push(await readJson(path.join(dir, file)));
  }
  return reports;
}

export function flattenActionDivergenceRows(reports = []) {
  return reports.flatMap((report) =>
    (report?.actionDivergence?.ranked ?? [])
      .filter((entry) => STEP27_VARIANTS.includes(String(entry?.variantId ?? "")))
      .map((entry) => {
        const bucketFamily = inferBucketFamily(entry);
        return {
          ...entry,
          bucketFamily,
          bucket: bucketFamily,
          pressureFamily: pressureFamily(entry),
          callBand: callBand(entry),
          selectedAction: entry.standardAction,
          sourceType: "standard-pro-action-divergence",
          frequency: Number(entry?.frequency ?? 0),
          standardAdvantage: Number(entry?.evGap ?? 0) < 0 ? Math.abs(Number(entry.evGap)) : 0,
        };
      }),
  );
}

export function aggregateBy(items = [], keyFn = () => "") {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

export function mergeVariantArenaSummary(arenaResults = []) {
  return [...aggregateBy(arenaResults, (result) => result.variant).entries()].map(([variant, rows]) => ({
    variant,
    samples: rows.length,
    ironEv: roundNumber(average(rows.map((row) => row.ironEv)), 4),
    proEv: roundNumber(average(rows.map((row) => row.proEv)), 4),
    standardEv: roundNumber(average(rows.map((row) => row.standardEv)), 4),
    ironProGap: roundNumber(average(rows.map((row) => row.ironProGap)), 4),
    ironStandardGap: roundNumber(average(rows.map((row) => row.ironStandardGap)), 4),
    standardAdvantage: roundNumber(average(rows.map((row) => -Number(row.ironStandardGap ?? 0))), 4),
    datasetHitRate: roundNumber(average(rows.map((row) => row.datasetHitRate)), 4),
    proFallbackRate: roundNumber(average(rows.map((row) => row.proFallbackRate)), 4),
    fallbackOnlyHands: sum(rows.map((row) => row.fallbackOnlyHands)),
    hitHands: sum(rows.map((row) => row.hitHands)),
    coveredBuckets: Array.from(
      new Set(rows.flatMap((row) => Object.keys(row.bucketHitDistribution ?? {}))),
    ).sort(),
  }));
}

export async function loadStep27Evidence() {
  const arenaReports = await loadArenaReports();
  const arenaResults = flattenArenaResults(arenaReports);
  const arenaSummary = mergeVariantArenaSummary(arenaResults);
  const divergenceReports = await loadStep4TActionDivergenceReports();
  const divergenceRows = flattenActionDivergenceRows(divergenceReports);
  return {
    arenaReports,
    arenaResults,
    arenaSummary,
    divergenceReports,
    divergenceRows,
  };
}
