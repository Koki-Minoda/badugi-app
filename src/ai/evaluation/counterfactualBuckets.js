import { classifyD01SubBucket } from "./d01SubBucketClassifier.js";

function normalizeBucketFilter(filter = []) {
  if (!Array.isArray(filter)) return [];
  return filter
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
}

export function bucketForReplaySample(sample = {}) {
  const handClass = String(sample.handClass ?? "");
  if (sample.variantId === "S02") {
    if (handClass === "premiumSDA5") return "premiumSDA5 CALL/RAISE";
    if (handClass === "strongSDA5") return "strongSDA5 CALL/FOLD/RAISE";
    if (handClass === "upperMediumSDA5") return "upperMediumSDA5 CHECK/BET";
    if (handClass === "trashSDA5") return "trashSDA5 FOLD/CALL verify";
  }
  if (sample.variantId === "S01") {
    if (handClass === "strongSD27") return "strongSD27 top-end pressure";
    if (handClass === "upperMediumSD27") return "upperMediumSD27 small-pressure";
    if (handClass === "trashSD27") return "trashSD27 FOLD/CALL verify";
  }
  if (sample.variantId === "D02") {
    if (handClass === "strongA5") return "strongA5 second-pressure";
    if (handClass === "mediumA5") return "mediumA5 small-pressure";
    if (handClass === "premiumA5") return "premiumA5 value spots";
    if (handClass === "trashA5") return "trashA5 FOLD/CALL verify";
  }
  if (sample.variantId === "D01") {
    if (String(sample.sampleTag ?? "").toLowerCase() === "iron-step7") {
      const subBucket = classifyD01SubBucket(sample);
      if (subBucket?.subBucketId) return subBucket.subBucketId;
    }
    if (handClass === "premium27TD") return "premium27TD late pressure";
    if (handClass === "strong27TD") return "strong27TD late pressure";
    if (handClass === "medium27TD") return "medium27TD pressure";
    if (handClass === "trash27TD") return "trash27TD FOLD/CALL verify";
  }
  return null;
}

export function shouldKeepReplaySample(sample = {}) {
  const bucket = bucketForReplaySample(sample);
  if (!bucket) return false;
  if (sample.variantId === "S02") {
    if (bucket.startsWith("premium") || bucket.startsWith("strong")) {
      return sample.facingAction === "raise" || sample.facingAction === "bet";
    }
    if (bucket.startsWith("upperMedium")) {
      return sample.facingAction === "none" || sample.facingAction === "bet";
    }
    return sample.playerCount >= 4 && sample.facingAction === "bet";
  }
  if (sample.variantId === "S01") {
    if (bucket.startsWith("strong")) return sample.facingAction !== "none";
    if (bucket.startsWith("upperMedium")) return sample.facingAction === "bet";
    return sample.playerCount >= 4 && sample.facingAction === "bet";
  }
  if (sample.variantId === "D02") {
    if (bucket.startsWith("strong")) return sample.facingAction !== "none";
    if (bucket.startsWith("medium")) return sample.facingAction === "bet";
    if (bucket.startsWith("premium")) return sample.facingAction === "none" || sample.facingAction === "bet";
    return sample.playerCount >= 4 && sample.facingAction === "bet";
  }
  if (sample.variantId === "D01") {
    if (bucket.startsWith("premium") || bucket.startsWith("strong")) {
      return sample.facingAction === "bet" || sample.facingAction === "raise";
    }
    if (bucket.startsWith("medium")) return sample.facingAction === "bet";
    return sample.playerCount >= 4 && sample.facingAction === "bet";
  }
  return false;
}

export function matchesReplayBucketFilter(sample = {}, filter = []) {
  const normalized = normalizeBucketFilter(filter);
  if (!normalized.length) return true;
  const bucket = String(bucketForReplaySample(sample) ?? "").toLowerCase();
  const handClass = String(sample.handClass ?? "").toLowerCase();
  const variantId = String(sample.variantId ?? "").toLowerCase();
  return normalized.some(
    (entry) => bucket.includes(entry) || handClass.includes(entry) || variantId === entry,
  );
}

export function parseReplaySampleFilename(fileName = "") {
  const tagged = String(fileName).match(/^([a-z0-9-]+)-([a-z0-9]+)-(\d{8})\.jsonl$/i);
  if (tagged) {
    return {
      tag: tagged[1],
      variant: tagged[2].toUpperCase(),
      seed: Number(tagged[3]),
    };
  }
  const legacy = String(fileName).match(/^([a-z0-9]+)-(\d{8})\.jsonl$/i);
  if (legacy) {
    return {
      tag: "legacy",
      variant: legacy[1].toUpperCase(),
      seed: Number(legacy[2]),
    };
  }
  return null;
}

export function replaySampleTagPriority(tag = "") {
  switch (String(tag ?? "").toLowerCase()) {
    case "iron-step7":
      return 9;
    case "iron-step6":
      return 8;
    case "iron-step2":
      return 6;
    case "iron-step4":
      return 7;
    case "step4y":
      return 5;
    case "step4x":
      return 4;
    case "step4w":
      return 3;
    case "step4v":
      return 2;
    case "legacy":
      return 1;
    default:
      return 0;
  }
}
