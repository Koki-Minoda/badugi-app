import { appendSystemEvent } from "./systemLog.js";
import { loadP2pCaptureFlag } from "./devOverrides.js";

const STORAGE_KEY = "playerRatingState";
const HISTORY_LIMIT = 30;
const DEFAULT_SKILL = 1500;
const DEFAULT_MIXED = 1500;
const DEFAULT_STYLE = 50;
const P2P_BUFFER_KEY = "rl_p2p_match_buffer_v1";
const MAX_P2P_MATCHES = 500;

const STYLE_PROFILES = [
  { id: "NIT", label: "NIT", test: ({ vpip = 0, pfr = 0 }) => vpip < 0.18 && pfr < 0.12 },
  { id: "TAG", label: "TAG", test: ({ vpip = 0, pfr = 0 }) => vpip < 0.24 && pfr >= 0.12 && pfr < 0.2 },
  { id: "LAG", label: "LAG", test: ({ vpip = 0 }) => vpip >= 0.24 && vpip < 0.4 },
  { id: "MANIAC", label: "MANIAC", test: ({ vpip = 0 }) => vpip >= 0.4 },
];

const DEFAULT_STATE = Object.freeze({
  skillRating: DEFAULT_SKILL,
  skillMatches: 0,
  skillDeviation: 350,
  mixedRating: DEFAULT_MIXED,
  mixedSamples: 0,
  styleRating: DEFAULT_STYLE,
  styleSamples: 0,
  styleProfile: "BALANCED",
  styleDiagnostics: null,
  globalRating: DEFAULT_SKILL,
  lastUpdatedAt: null,
  history: [],
  antiCheatAlerts: [],
});

const TARGETS = Object.freeze({
  vpip: { min: 0.22, max: 0.34 },
  pfr: { min: 0.13, max: 0.22 },
  aggression: { min: 1.5, max: 2.8 },
  showdown: { min: 0.4, max: 0.58 },
  bluff: { min: 0.05, max: 0.18 },
});

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function broadcast(state) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("badugi:ratingState-changed", { detail: state }));
}

function appendP2PMatchRecord(entry) {
  if (!entry || !hasStorage()) return;
  try {
    const storage = window.localStorage;
    const existing = storage.getItem(P2P_BUFFER_KEY);
    const nextLine = JSON.stringify(entry);
    const merged = existing && existing.length ? `${existing}\n${nextLine}` : nextLine;
    const lines = merged
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const trimmed = lines.slice(-MAX_P2P_MATCHES).join("\n");
    storage.setItem(P2P_BUFFER_KEY, trimmed);
  } catch (err) {
    console.warn("[RatingState] Failed to append P2P record", err);
  }
}

export function exportP2PMatchesAsJSONL() {
  if (!hasStorage()) return;
  try {
    const storage = window.localStorage;
    const payload = storage.getItem(P2P_BUFFER_KEY) ?? "";
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `badugi_p2p_${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("[RatingState] Failed to export P2P matches", err);
  }
}

function normalizeState(state = {}) {
  const skillRating = clamp(Math.round(state.skillRating ?? DEFAULT_SKILL), 400, 3200);
  const mixedRating = clamp(Math.round(state.mixedRating ?? DEFAULT_MIXED), 400, 3500);
  const styleRating = clamp(Number(state.styleRating ?? DEFAULT_STYLE), 0, 100);
  const globalRating = Math.round(skillRating * 0.7 + mixedRating * 0.3);
  const history = Array.isArray(state.history) ? state.history.slice(0, HISTORY_LIMIT) : [];
  const antiCheatAlerts = Array.isArray(state.antiCheatAlerts)
    ? state.antiCheatAlerts.slice(0, 10)
    : [];
  return {
    ...DEFAULT_STATE,
    ...state,
    skillRating,
    mixedRating,
    styleRating,
    globalRating,
    history,
    antiCheatAlerts,
  };
}

function computeRangeScore(value = 0, target = TARGETS.vpip) {
  if (!target) return 0.5;
  const min = target.min ?? 0;
  const max = target.max ?? min;
  if (value >= min && value <= max) return 1;
  if (value < min) {
    const diff = min - value;
    return Math.max(0, 1 - diff / Math.max(0.01, min));
  }
  const diff = value - max;
  return Math.max(0, 1 - diff / Math.max(0.01, 1 - max));
}

function classifyProfile(metrics = {}) {
  const match = STYLE_PROFILES.find((profile) => profile.test(metrics));
  return match ? match.label : "BALANCED";
}

function computeStyleScore(metrics = {}) {
  if (!metrics || metrics.samples <= 0) {
    return { score: DEFAULT_STYLE, profile: "BALANCED", diagnostics: null };
  }
  const vpip = clamp(metrics.vpip ?? 0, 0, 1);
  const pfr = clamp(metrics.pfr ?? 0, 0, 1);
  const aggression = clamp(metrics.aggression ?? 0, 0, 5);
  const showdown = clamp(metrics.showdown ?? 0, 0, 1);
  const bluff = clamp(metrics.bluff ?? 0, 0, 1);

  const vpipScore = computeRangeScore(vpip, TARGETS.vpip);
  const pfrScore = computeRangeScore(pfr, TARGETS.pfr);
  const aggressionScore = computeRangeScore(aggression / 3, {
    min: TARGETS.aggression.min / 3,
    max: TARGETS.aggression.max / 3,
  });
  const showdownScore = computeRangeScore(showdown, TARGETS.showdown);
  const bluffScore = computeRangeScore(bluff, TARGETS.bluff);

  const avgScore = (vpipScore + pfrScore + aggressionScore + showdownScore + bluffScore) / 5;
  const profile = classifyProfile({ vpip, pfr, aggression });
  return {
    score: clamp(Math.round(avgScore * 100), 0, 100),
    profile,
    diagnostics: {
      vpip,
      pfr,
      aggression,
      showdown,
      bluff,
      vpipScore,
      pfrScore,
      aggressionScore,
      showdownScore,
      bluffScore,
    },
  };
}

function computeExpectedScore(myRating, opponentRating) {
  const diff = (opponentRating ?? DEFAULT_SKILL) - (myRating ?? DEFAULT_SKILL);
  return 1 / (1 + 10 ** (diff / 400));
}

function toOutcome(result) {
  if (typeof result === "number") {
    if (result > 1) return 1;
    if (result < 0) return 0;
    return result;
  }
  if (result === "win") return 1;
  if (result === "loss") return 0;
  if (result === "draw") return 0.5;
  return 0.5;
}

function detectAntiCheatAnomaly({
  entry,
  ratingBefore,
  opponentRating,
  mode,
  kFactor,
}) {
  if (!entry) return null;
  const skillJump = Math.abs(entry.deltas?.skill ?? 0);
  if (skillJump >= 120 || (kFactor ?? 0) >= 80) {
    return {
      reason: "LARGE_DELTA",
      detail: `Skill delta ${skillJump}`,
      severity: "high",
    };
  }
  const beforeSkill = ratingBefore?.skill ?? DEFAULT_SKILL;
  if (
    mode === "ring" &&
    entry.result === 1 &&
    opponentRating <= beforeSkill - 400
  ) {
    return {
      reason: "LOW_OPPONENT_FARMING",
      detail: `Opp ${opponentRating} vs ${beforeSkill}`,
      severity: "medium",
    };
  }
  return null;
}

function shouldCaptureP2P(mode, metadata) {
  if (mode === "p2p") return true;
  if (metadata?.p2pMatch) return true;
  return Boolean(loadP2pCaptureFlag());
}

export function loadRatingState() {
  if (!hasStorage()) return normalizeState(DEFAULT_STATE);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return normalizeState({ ...DEFAULT_STATE, ...parsed });
  } catch (err) {
    console.warn("[RatingState] Failed to load", err);
    return normalizeState(DEFAULT_STATE);
  }
}

export function saveRatingState(partial, options = {}) {
  const base = loadRatingState();
  const merged = normalizeState({ ...base, ...(partial || {}) });
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn("[RatingState] Failed to save", err);
    }
  }
  if (!options.silent) {
    appendSystemEvent({
      type: "RATING_UPDATE",
      reason: options.reason ?? "manual",
      deltas: options.deltas ?? null,
      context: options.context ?? null,
      rating: {
        skill: merged.skillRating,
        mixed: merged.mixedRating,
        style: merged.styleRating,
        global: merged.globalRating,
      },
    });
  }
  broadcast(merged);
  return merged;
}

export function resetRatingState() {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("[RatingState] Failed to reset", err);
    }
  }
  const normalized = normalizeState(DEFAULT_STATE);
  broadcast(normalized);
  return normalized;
}

export function applyMatchRatings({
  result = 1,
  opponentRating = DEFAULT_SKILL,
  kFactor = 24,
  mixedResult = null,
  mixedOpponentRating = null,
  mixedWeight = 1,
  styleMetrics = null,
  stageId = "ring",
  mode = "ring",
  metadata = {},
} = {}) {
  const current = loadRatingState();
  const outcome = toOutcome(result);
  const expected = computeExpectedScore(current.skillRating, opponentRating);
  const skillDelta = kFactor * (outcome - expected);
  const skillRating = clamp(Math.round(current.skillRating + skillDelta), 400, 3200);
  const skillMatches = (current.skillMatches ?? 0) + 1;

  const mixedOutcome = mixedResult != null ? toOutcome(mixedResult) : outcome;
  const mixedOpp = Number.isFinite(mixedOpponentRating)
    ? mixedOpponentRating
    : opponentRating;
  const mixedExpected = computeExpectedScore(current.mixedRating, mixedOpp);
  const mixedK = Math.max(16, Math.min(64, 20 * mixedWeight));
  const mixedDelta = mixedK * (mixedOutcome - mixedExpected);
  const mixedRating = clamp(Math.round(current.mixedRating + mixedDelta), 400, 3600);
  const mixedSamples = (current.mixedSamples ?? 0) + mixedWeight;

  let styleRating = current.styleRating ?? DEFAULT_STYLE;
  let styleSamples = current.styleSamples ?? 0;
  let styleProfile = current.styleProfile ?? "BALANCED";
  let styleDiagnostics = current.styleDiagnostics ?? null;
  let styleDelta = 0;
  if (styleMetrics && styleMetrics.samples > 0) {
    const { score, profile, diagnostics } = computeStyleScore(styleMetrics);
    const totalSamples = styleSamples + styleMetrics.samples;
    const blended = (styleRating * styleSamples + score * styleMetrics.samples) / totalSamples;
    styleDelta = blended - styleRating;
    styleRating = clamp(blended, 0, 100);
    styleSamples = totalSamples;
    styleProfile = profile;
    styleDiagnostics = diagnostics;
  }

  const globalRating = Math.round(skillRating * 0.7 + mixedRating * 0.3);
  const ratingBefore = {
    skill: current.skillRating,
    mixed: current.mixedRating,
    style: current.styleRating,
    global: current.globalRating ?? Math.round(current.skillRating * 0.7 + current.mixedRating * 0.3),
  };
  const entry = {
    id: `rating-${Date.now()}`,
    timestamp: Date.now(),
    mode,
    stageId,
    opponentRating,
    result: outcome,
    deltas: {
      skill: Math.round(skillDelta),
      mixed: Math.round(mixedDelta),
      style: Number(styleDelta.toFixed(2)),
    },
    ratingAfter: {
      skill: skillRating,
      mixed: mixedRating,
      style: styleRating,
      global: globalRating,
    },
    metadata,
  };
  const history = [entry, ...(current.history ?? [])].slice(0, HISTORY_LIMIT);
  let antiCheatAlerts = current.antiCheatAlerts ?? [];
  const anomaly = detectAntiCheatAnomaly({
    entry,
    ratingBefore,
    opponentRating,
    mode,
    kFactor,
  });
  if (anomaly) {
    const alertRecord = {
      id: `alert-${Date.now()}`,
      timestamp: entry.timestamp,
      ...anomaly,
      mode,
      stageId,
    };
    antiCheatAlerts = [alertRecord, ...antiCheatAlerts].slice(0, 10);
    appendSystemEvent({
      type: "ANTI_CHEAT_ALERT",
      reason: anomaly.reason,
      detail: anomaly.detail,
      severity: anomaly.severity,
      ratingBefore,
      ratingAfter: entry.ratingAfter,
      stageId,
      mode,
    });
  }

  const updatedState = saveRatingState(
    {
      skillRating,
      skillMatches,
      mixedRating,
      mixedSamples,
      styleRating,
      styleSamples,
      styleProfile,
      styleDiagnostics,
      globalRating,
      history,
      lastUpdatedAt: Date.now(),
      antiCheatAlerts,
    },
    {
      reason: "match",
      deltas: entry.deltas,
      context: { mode, stageId },
    }
  );
  if (shouldCaptureP2P(mode, metadata)) {
    appendP2PMatchRecord({
      ...entry,
      ratingBefore,
    });
  }
  return updatedState;
}

export function computeStyleScorePreview(metrics) {
  return computeStyleScore(metrics);
}

export const RANK_TIERS = Object.freeze([
  { id: "legend", label: "Legend", min: 2800 },
  { id: "grandmaster", label: "Grand Master", min: 2600 },
  { id: "master", label: "Master", min: 2400 },
  { id: "diamond", label: "Diamond", min: 2200 },
  { id: "platinum", label: "Platinum", min: 2000 },
  { id: "gold", label: "Gold", min: 1850 },
  { id: "silver", label: "Silver", min: 1700 },
  { id: "bronze", label: "Bronze", min: 0 },
]);

export function computeRankFromRating(globalRating = DEFAULT_SKILL) {
  const value = Number.isFinite(globalRating) ? globalRating : DEFAULT_SKILL;
  const tier =
    RANK_TIERS.find((candidate) => value >= candidate.min) ||
    RANK_TIERS[RANK_TIERS.length - 1];
  const currentIndex = RANK_TIERS.findIndex((t) => t.id === tier.id);
  const nextTier = currentIndex > 0 ? RANK_TIERS[currentIndex - 1] : null;
  const floor = tier.min;
  const ceiling = nextTier ? nextTier.min : value;
  const span = Math.max(1, (nextTier ? nextTier.min : floor + 200) - floor);
  const progress = clamp((value - floor) / span, 0, 1);
  return {
    ...tier,
    rating: value,
    nextTier,
    progress,
  };
}
